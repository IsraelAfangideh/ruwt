-- Hidden test cases: only run on submission, never exposed to frontend or AI
ALTER TABLE challenges ADD COLUMN hidden_test_cases TEXT;
