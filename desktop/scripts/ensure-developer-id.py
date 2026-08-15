#!/usr/bin/env python3
"""Create or restore a Developer ID Application identity for CI.

Uses the App Store Connect API key already stored for the iOS app
(APP_STORE_CONNECT_API_KEY_*). Persists the private key as an encrypted
.p12 under desktop/.signing so later runs reuse the same cert.

Writes APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY,
and APPLE_TEAM_ID to GITHUB_ENV when present.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SIGNING = ROOT / ".signing"
P12 = SIGNING / "developer-id.p12"
P12_ENC = SIGNING / "developer-id.p12.enc"
KEY_PEM = SIGNING / "developer-id.key.pem"
CSR_PEM = SIGNING / "developer-id.csr.pem"
CERT_PEM = SIGNING / "developer-id.cert.pem"
AUTH_KEY = SIGNING / "AuthKey.p8"
ASC = "https://api.appstoreconnect.apple.com"
TEAM_ID = os.environ.get("APPLE_TEAM_ID") or "S5G585GH4X"
CERT_TYPES = ("DEVELOPER_ID_APPLICATION", "DEVELOPER_ID_APPLICATION_G2")


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    printable = [
        "pass:***" if arg.startswith("pass:") or arg.startswith("passout") else arg
        for arg in args
    ]
    print(" ".join(printable), flush=True)
    return subprocess.run(args, check=True, text=True, capture_output=True, **kwargs)


def p8_pem() -> str:
    raw = os.environ.get("APP_STORE_CONNECT_API_KEY_KEY", "").strip()
    if not raw:
        raise SystemExit("APP_STORE_CONNECT_API_KEY_KEY is empty. It is the same secret iOS TestFlight uses.")
    if "\\n" in raw and "BEGIN" in raw:
        raw = raw.replace("\\n", "\n")
    if "BEGIN" not in raw:
        decoded = base64.b64decode(raw).decode()
        if "BEGIN" not in decoded:
            raise SystemExit("APP_STORE_CONNECT_API_KEY_KEY is not a PEM or base64 PEM.")
        raw = decoded
    return raw if raw.endswith("\n") else raw + "\n"


def wrap_pass() -> str:
    material = p8_pem() + os.environ.get("APP_STORE_CONNECT_API_KEY_KEY_ID", "")
    return hashlib.sha256(material.encode()).hexdigest()


def p12_pass() -> str:
    return hashlib.sha256((wrap_pass() + ":p12").encode()).hexdigest()[:32]


def jwt_token() -> str:
    import jwt  # PyJWT, installed in the CI venv

    key_id = os.environ["APP_STORE_CONNECT_API_KEY_KEY_ID"].strip()
    issuer = os.environ["APP_STORE_CONNECT_API_KEY_ISSUER_ID"].strip()
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer, "iat": now, "exp": now + 20 * 60, "aud": "appstoreconnect-v1"},
        p8_pem(),
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def api(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        ASC + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {jwt_token()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise SystemExit(f"App Store Connect {method} {path} failed ({error.code}):\n{detail}") from error


def write_github_env(values: dict[str, str]) -> None:
    github_env = os.environ.get("GITHUB_ENV")
    if not github_env:
        for key, value in values.items():
            print(f"{key}={value[:24]}…" if len(value) > 32 else f"{key}={value}", flush=True)
        return
    with open(github_env, "a", encoding="utf-8") as handle:
        for key, value in values.items():
            if "\n" in value:
                handle.write(f"{key}<<EOF\n{value}\nEOF\n")
            else:
                handle.write(f"{key}={value}\n")


def identity_from_cert(pem: Path) -> str:
    subject = run(["openssl", "x509", "-in", str(pem), "-noout", "-subject", "-nameopt", "RFC2253"]).stdout.strip()
    for part in subject.removeprefix("subject=").split(","):
        part = part.strip()
        if part.startswith("CN="):
            return part[3:]
    raise SystemExit(f"could not read CN from {pem}: {subject}")


def export_p12() -> None:
    SIGNING.mkdir(parents=True, exist_ok=True)
    cmd = [
        "openssl", "pkcs12", "-export",
        "-inkey", str(KEY_PEM),
        "-in", str(CERT_PEM),
        "-out", str(P12),
        "-passout", f"pass:{p12_pass()}",
        "-name", "Ruwt Developer ID",
    ]
    try:
        run(cmd)
    except subprocess.CalledProcessError:
        run(cmd + ["-legacy"])
    run([
        "openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
        "-in", str(P12), "-out", str(P12_ENC),
        "-pass", f"pass:{wrap_pass()}",
    ])


def cert_from_p12(password: str) -> None:
    args = ["openssl", "pkcs12", "-in", str(P12), "-passin", f"pass:{password}", "-nokeys", "-clcerts", "-out", str(CERT_PEM)]
    try:
        run(args)
    except subprocess.CalledProcessError:
        run(args + ["-legacy"])


def restore_p12() -> bool:
    if os.environ.get("APPLE_CERTIFICATE", "").strip():
        print("Using APPLE_CERTIFICATE secret", flush=True)
        P12.write_bytes(base64.b64decode(os.environ["APPLE_CERTIFICATE"]))
        cert_from_p12(os.environ.get("APPLE_CERTIFICATE_PASSWORD") or p12_pass())
        return True
    if not P12_ENC.is_file():
        return False
    print("Restoring Developer ID from encrypted cache", flush=True)
    run([
        "openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
        "-in", str(P12_ENC), "-out", str(P12),
        "-pass", f"pass:{wrap_pass()}",
    ])
    try:
        cert_from_p12(p12_pass())
    except subprocess.CalledProcessError:
        print("Cached p12 could not be opened; minting a new certificate", flush=True)
        return False
    return True


def mint_certificate() -> None:
    SIGNING.mkdir(parents=True, exist_ok=True)
    run([
        "openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes",
        "-keyout", str(KEY_PEM), "-out", str(CSR_PEM),
        "-subj", "/CN=Ruwt Desktop/OU=S5G585GH4X/O=Ruwt/C=US/emailAddress=israelafangideh@gmail.com",
    ])
    csr = CSR_PEM.read_text()
    last_error = ""
    created = None
    for cert_type in CERT_TYPES:
        print(f"Requesting {cert_type}", flush=True)
        try:
            created = api("POST", "/v1/certificates", {
                "data": {
                    "type": "certificates",
                    "attributes": {"certificateType": cert_type, "csrContent": csr},
                }
            })
            break
        except SystemExit as error:
            last_error = str(error)
            print(last_error, flush=True)
    if created is None:
        if "REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED" in last_error:
            raise SystemExit(
                "Apple rejected Developer ID creation because a paid-program agreement "
                "is missing or expired.\n"
                "Sign in as Account Holder and accept the latest agreements:\n"
                "  https://developer.apple.com/account\n"
                "  https://appstoreconnect.apple.com/agreements\n"
                "Then re-run the Release Desktop workflow."
            )
        try:
            existing = api("GET", "/v1/certificates?limit=200")
        except SystemExit:
            existing = {"data": []}
        names = [
            f"{row.get('attributes', {}).get('certificateType')} {row.get('attributes', {}).get('name')} {row.get('id')}"
            for row in existing.get("data", [])
            if "DEVELOPER_ID_APPLICATION" in str(row.get("attributes", {}).get("certificateType", ""))
        ]
        extra = "\nExisting Developer ID certs:\n" + "\n".join(names) if names else ""
        raise SystemExit(
            "Could not create a Developer ID Application certificate from the App Store Connect API key.\n"
            "Create the cert at https://developer.apple.com/account/resources/certificates/add\n"
            f"{extra}\n{last_error}"
        )
    der = base64.b64decode(created["data"]["attributes"]["certificateContent"])
    Path(str(CERT_PEM) + ".der").write_bytes(der)
    run(["openssl", "x509", "-inform", "DER", "-in", str(CERT_PEM) + ".der", "-out", str(CERT_PEM)])
    export_p12()


def emit() -> None:
    AUTH_KEY.write_text(p8_pem())
    identity = os.environ.get("APPLE_SIGNING_IDENTITY", "").strip()
    if not identity or identity == "-":
        identity = identity_from_cert(CERT_PEM)
    certificate = base64.b64encode(P12.read_bytes()).decode()
    write_github_env({
        "APPLE_CERTIFICATE": certificate,
        "APPLE_CERTIFICATE_PASSWORD": os.environ.get("APPLE_CERTIFICATE_PASSWORD") or p12_pass(),
        "APPLE_SIGNING_IDENTITY": identity,
        "APPLE_TEAM_ID": TEAM_ID,
        "APPLE_API_KEY": os.environ["APP_STORE_CONNECT_API_KEY_KEY_ID"].strip(),
        "APPLE_API_ISSUER": os.environ["APP_STORE_CONNECT_API_KEY_ISSUER_ID"].strip(),
        "APPLE_API_KEY_PATH": str(AUTH_KEY),
    })
    print(f"signing identity: {identity}", flush=True)


def main() -> None:
    for name in ("APP_STORE_CONNECT_API_KEY_KEY", "APP_STORE_CONNECT_API_KEY_KEY_ID", "APP_STORE_CONNECT_API_KEY_ISSUER_ID"):
        if not os.environ.get(name, "").strip():
            raise SystemExit(f"missing {name}")
    SIGNING.mkdir(parents=True, exist_ok=True)
    if not restore_p12():
        mint_certificate()
    emit()


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        sys.stderr.write((error.stderr or error.stdout or str(error)) + "\n")
        raise
