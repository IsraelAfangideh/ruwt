-- Fix qr-count-vowels hidden test case 3: "The quick brown fox" has 5 vowels (e,u,i,o,o), not 4
UPDATE challenges SET hidden_test_cases = '[{"input":"aeiouAEIOU","expectedOutput":"10","hint":"Mixed case vowels"},{"input":"bcdfg","expectedOutput":"0","hint":"No vowels at all"},{"input":"The quick brown fox","expectedOutput":"5","hint":"Sentence with spaces"},{"input":"rhythm","expectedOutput":"0","hint":"Word with no standard vowels"}]'
WHERE id = 'qr-count-vowels';
