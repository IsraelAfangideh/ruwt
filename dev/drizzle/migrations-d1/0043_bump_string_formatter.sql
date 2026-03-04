-- Bump Config Key Normalizer from easy/onboarding to medium/core
-- Premium models (Llama 3.3 70B) can't solve it; only 2/5 users passed.
-- Violates "easy + premium = should pass" philosophy.
UPDATE challenges SET difficulty = 'medium', tier = 'core' WHERE id = 'string-formatter';
