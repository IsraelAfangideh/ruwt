-- Migration 0053: Fix corrupted-json-parser challenge
-- Problem: starter code was accidentally fixed during 0050 rewrite — all tests pass without edits.
-- Fix: re-introduce 3 real bugs and add test cases that actually exercise them.
--
-- Bug 1: Escaped quotes — backslash handling is missing, so "say \"hi\"" breaks
-- Bug 2: Whitespace before delimiters in arrays — parseArray checks str[i]===',' without
--         skipWhitespace() first, so spaces before commas (e.g. [1 , 2]) cause the loop to exit early
-- Bug 3: Object colon — missing skipWhitespace() between key and colon, so {"a" : 1} breaks

UPDATE challenges SET
  description = 'Fix this JSON parser. It handles strings, numbers, booleans, null, arrays and objects but has edge case bugs with:
Bug 1: Escaped characters in strings — the parser doesn''t handle backslash escapes at all, so strings containing \" or \\ break it.
Bug 2: Whitespace before delimiters in arrays — after parsing an element, the parser checks for a comma immediately without skipping whitespace first, so [1 , 2] fails.
Bug 3: Whitespace in objects — the parser doesn''t skip whitespace before keys (after commas) or before colons, so { "a" : 1, "b": 2 } fails.
The function parseJSON(str) should return the parsed JavaScript value. It must handle:
- Strings (with escaped quotes like "say \"hi\"")
- Numbers (integers and decimals)
- Booleans (true/false)
- null
- Arrays (nested, with flexible whitespace)
- Objects (nested, with flexible whitespace)
Input: a JSON string.
Output: the parsed value, stringified back to JSON for comparison.
Fix all 3 bugs. Use AI to identify edge cases.',
  starter_code = 'function parseJSON(str) {
  // Fix the bugs in this JSON parser
  let i = 0;

  function parseValue() {
    skipWhitespace();
    if (str[i] === ''"'') return parseString();
    if (str[i] === ''{'') return parseObject();
    if (str[i] === ''['') return parseArray();
    if (str[i] === ''t'' || str[i] === ''f'') return parseBoolean();
    if (str[i] === ''n'') return parseNull();
    return parseNumber();
  }

  function skipWhitespace() {
    while (i < str.length && '' \t\n\r''.includes(str[i])) i++;
  }

  function parseString() {
    i++; // skip opening quote
    let result = '''';
    while (i < str.length && str[i] !== ''"'') {
      // Bug 1: no backslash handling — escaped quotes break the parser
      result += str[i];
      i++;
    }
    i++; // skip closing quote
    return result;
  }

  function parseNumber() {
    let start = i;
    if (str[i] === ''-'') i++;
    while (i < str.length && str[i] >= ''0'' && str[i] <= ''9'') i++;
    if (str[i] === ''.'') {
      i++;
      while (i < str.length && str[i] >= ''0'' && str[i] <= ''9'') i++;
    }
    return Number(str.slice(start, i));
  }

  function parseBoolean() {
    if (str.slice(i, i + 4) === ''true'') { i += 4; return true; }
    if (str.slice(i, i + 5) === ''false'') { i += 5; return false; }
  }

  function parseNull() {
    i += 4;
    return null;
  }

  function parseArray() {
    i++; // skip [
    const arr = [];
    skipWhitespace();
    if (str[i] === '']'') { i++; return arr; }
    arr.push(parseValue());
    // Bug 2: after first element, loop checks for comma but never skips whitespace
    // so [1 , 2] fails because str[i] is '' '' not '',''
    while (str[i] === '','') {
      i++; // skip comma
      arr.push(parseValue());
    }
    i++; // skip ]
    return arr;
  }

  function parseObject() {
    i++; // skip {
    const obj = {};
    skipWhitespace();
    if (str[i] === ''}'') { i++; return obj; }
    while (true) {
      // Bug 3: no skipWhitespace before parseString — fails on { "a": 1 } after comma
      const key = parseString();
      // Bug 3 continued: no skipWhitespace before colon — fails on {"a" : 1}
      i++; // skip colon
      obj[key] = parseValue();
      skipWhitespace();
      if (str[i] === ''}'') { i++; return obj; }
      i++; // skip comma
    }
  }

  return parseValue();
}',
  test_cases = '[{"input":"\"hello\"","expectedOutput":"\"hello\""},{"input":"42","expectedOutput":"42"},{"input":"[1, 2, 3]","expectedOutput":"[1,2,3]"},{"input":"{\"a\": 1, \"b\": 2}","expectedOutput":"{\"a\":1,\"b\":2}"},{"input":"{\"nested\": {\"arr\": [1, true, null]}}","expectedOutput":"{\"nested\":{\"arr\":[1,true,null]}}"}]',
  hidden_test_cases = '[{"input":"true","expectedOutput":"true"},{"input":"null","expectedOutput":"null"},{"input":"[true, false, null]","expectedOutput":"[true,false,null]"},{"input":"\"say \\\"hi\\\"\"","expectedOutput":"\"say \\\"hi\\\"\""},{"input":"{ \"a\" : [ 1 , { \"b\" : 2 } ] }","expectedOutput":"{\"a\":[1,{\"b\":2}]}"},{"input":"\"\"","expectedOutput":"\"\""},{"input":"{\"deeply\":{\"nested\":{\"value\":42}}}","expectedOutput":"{\"deeply\":{\"nested\":{\"value\":42}}}"},{"input":"[\"a\\\\b\", \"c\\\"d\"]","expectedOutput":"[\"a\\\\b\",\"c\\\"d\"]"},{"input":"{\"key with spaces\" : [1 , 2 , 3]}","expectedOutput":"{\"key with spaces\":[1,2,3]}"}]'
WHERE id = 'corrupted-json-parser';
