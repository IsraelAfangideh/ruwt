-- Assessment branding for company-branded candidate experience
ALTER TABLE assessments ADD COLUMN company_name TEXT;
ALTER TABLE assessments ADD COLUMN company_logo_url TEXT;
ALTER TABLE assessments ADD COLUMN welcome_message TEXT;
