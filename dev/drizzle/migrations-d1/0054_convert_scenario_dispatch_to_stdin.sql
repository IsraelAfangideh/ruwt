-- Migration 0052: Convert 13 scenario-dispatch challenges to stdin mode.
-- These challenges had meaningless scenario names as test inputs
-- (e.g., "single-key-asc" → "sorted-asc"). Now they use actual JSON
-- data so AI models can understand input→output relationships.
-- Server-side harnesses read stdin, call the function, print JSON result.

-- ============================================================
-- 1. algorithmic-sort (JavaScript)
--    Function: stableSort(arr, keys)
--    Input: JSON array [arr, keys]
--    Output: JSON sorted array
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());console.log(JSON.stringify(stableSort(_a[0],_a[1])));});',
  test_cases = '[{"input":"[[{\"n\":3},{\"n\":1},{\"n\":2}],[{\"field\":\"n\",\"order\":\"asc\"}]]","expectedOutput":"[{\"n\":1},{\"n\":2},{\"n\":3}]"},{"input":"[[{\"n\":1},{\"n\":3},{\"n\":2}],[{\"field\":\"n\",\"order\":\"desc\"}]]","expectedOutput":"[{\"n\":3},{\"n\":2},{\"n\":1}]"},{"input":"[[{\"dept\":\"B\",\"name\":\"Zara\"},{\"dept\":\"A\",\"name\":\"Yuki\"},{\"dept\":\"A\",\"name\":\"Amy\"}],[{\"field\":\"dept\",\"order\":\"asc\"},{\"field\":\"name\",\"order\":\"asc\"}]]","expectedOutput":"[{\"dept\":\"A\",\"name\":\"Amy\"},{\"dept\":\"A\",\"name\":\"Yuki\"},{\"dept\":\"B\",\"name\":\"Zara\"}]"}]',
  hidden_test_cases = '[{"input":"[[{\"s\":\"banana\"},{\"s\":\"Apple\"},{\"s\":\"cherry\"}],[{\"field\":\"s\",\"order\":\"asc\"}]]","expectedOutput":"[{\"s\":\"Apple\"},{\"s\":\"banana\"},{\"s\":\"cherry\"}]"},{"input":"[[{\"k\":1,\"v\":\"a\"},{\"k\":1,\"v\":\"b\"},{\"k\":1,\"v\":\"c\"}],[{\"field\":\"k\",\"order\":\"asc\"}]]","expectedOutput":"[{\"k\":1,\"v\":\"a\"},{\"k\":1,\"v\":\"b\"},{\"k\":1,\"v\":\"c\"}]"}]'
WHERE id ='algorithmic-sort';

-- ============================================================
-- 2. array-flatten (JavaScript)
--    Function: flatten(arr, opts)
--    Input: JSON array [arr, opts] — filter encoded as string key
--    Output: JSON flattened array
--    Harness maps filter strings to actual functions
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'const _filters={''even'':x=>x%2===0};let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());const opts=_a[1]||{};if(typeof opts.filter===''string'')opts.filter=_filters[opts.filter];console.log(JSON.stringify(flatten(_a[0],opts)));});',
  test_cases = '[{"input":"[[1,[2,[3,[4]]]],{}]","expectedOutput":"[1,2,3,4]"},{"input":"[[1,[2,[3,[4]]]],{\"depth\":1}]","expectedOutput":"[1,2,[3,[4]]]"},{"input":"[[1,[2,3]],{\"depth\":0}]","expectedOutput":"[1,[2,3]]"},{"input":"[[1,[2,[3,4]]],{\"filter\":\"even\"}]","expectedOutput":"[1,3]"}]',
  hidden_test_cases = '[{"input":"[[1,[2,1,[3,2]]],{\"unique\":true}]","expectedOutput":"[1,2,3]"},{"input":"[[1,[2,[1,[3,2]]]],{\"depth\":2,\"unique\":true}]","expectedOutput":"[1,2,[3,2]]"}]'
WHERE id ='array-flatten';

-- ============================================================
-- 3. compression-rle (JavaScript)
--    Functions: pack(schema, values), unpack(schema, packed)
--    Input: JSON array [schema, values]
--    Output: JSON unpacked values (round-trip: pack then unpack)
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());console.log(JSON.stringify(unpack(_a[0],pack(_a[0],_a[1]))));});',
  test_cases = '[{"input":"[[{\"name\":\"r\",\"bits\":8},{\"name\":\"g\",\"bits\":8},{\"name\":\"b\",\"bits\":8}],{\"r\":255,\"g\":128,\"b\":0}]","expectedOutput":"{\"r\":255,\"g\":128,\"b\":0}"},{"input":"[[{\"name\":\"x\",\"bits\":4}],{\"x\":255}]","expectedOutput":"{\"x\":15}"},{"input":"[[{\"name\":\"type\",\"bits\":4},{\"name\":\"id\",\"bits\":12},{\"name\":\"flags\",\"bits\":8}],{\"type\":5,\"id\":1000,\"flags\":3}]","expectedOutput":"{\"type\":5,\"id\":1000,\"flags\":3}"}]',
  hidden_test_cases = '[{"input":"[[{\"name\":\"a\",\"bits\":1},{\"name\":\"b\",\"bits\":1},{\"name\":\"c\",\"bits\":1}],{\"a\":1,\"b\":0,\"c\":1}]","expectedOutput":"{\"a\":1,\"b\":0,\"c\":1}"},{"input":"[[{\"name\":\"x\",\"bits\":16},{\"name\":\"y\",\"bits\":16}],{\"x\":12345,\"y\":54321}]","expectedOutput":"{\"x\":12345,\"y\":54321}"}]'
WHERE id ='compression-rle';

-- ============================================================
-- 4. devops-env-resolver (JavaScript)
--    Function: resolveEnv(envString)
--    Input: JSON string (the env text)
--    Output: JSON resolved object
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const r=resolveEnv(_i.trim());console.log(JSON.stringify(r));});',
  test_cases = '[{"input":"DB_HOST=localhost\nDB_PORT=5432\nDEBUG=true","expectedOutput":"{\"DB_HOST\":\"localhost\",\"DB_PORT\":\"5432\",\"DEBUG\":\"true\"}"},{"input":"DB_HOST=localhost\nDB_PORT=5432\nDB_URL=postgres://${DB_HOST}:${DB_PORT}/mydb","expectedOutput":"{\"DB_HOST\":\"localhost\",\"DB_PORT\":\"5432\",\"DB_URL\":\"postgres://localhost:5432/mydb\"}"},{"input":"C=hello\nB=${C}\nA=${B}","expectedOutput":"{\"C\":\"hello\",\"B\":\"hello\",\"A\":\"hello\"}"}]',
  hidden_test_cases = '[{"input":"A=${B}\nB=${C}\nC=${A}","expectedOutput":"{\"error\":\"circular\",\"keys\":[\"A\",\"B\",\"C\"]}"},{"input":"GREETING=hello \\${WORLD}\nWORLD=earth","expectedOutput":"{\"GREETING\":\"hello ${WORLD}\",\"WORLD\":\"earth\"}"}]'
WHERE id ='devops-env-resolver';

-- ============================================================
-- 5. json-transformer (JavaScript)
--    Function: applyPatch(doc, ops)
--    Input: JSON array [doc, ops]
--    Output: JSON patched document (errors as {error: message})
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());try{console.log(JSON.stringify(applyPatch(_a[0],_a[1])));}catch(e){console.log(JSON.stringify({error:e.message}));}});',
  test_cases = '[{"input":"[{\"a\":1},[{\"op\":\"add\",\"path\":\"/b\",\"value\":2}]]","expectedOutput":"{\"a\":1,\"b\":2}"},{"input":"[{\"a\":1,\"b\":2},[{\"op\":\"remove\",\"path\":\"/b\"}]]","expectedOutput":"{\"a\":1}"},{"input":"[{\"a\":1},[{\"op\":\"replace\",\"path\":\"/a\",\"value\":99}]]","expectedOutput":"{\"a\":99}"},{"input":"[{\"a\":1,\"b\":{\"c\":2}},[{\"op\":\"move\",\"from\":\"/b/c\",\"path\":\"/d\"}]]","expectedOutput":"{\"a\":1,\"b\":{},\"d\":2}"}]',
  hidden_test_cases = '[{"input":"[{\"a\":1},[{\"op\":\"test\",\"path\":\"/a\",\"value\":1}]]","expectedOutput":"{\"a\":1}"},{"input":"[{\"arr\":[1,2]},[{\"op\":\"add\",\"path\":\"/arr/-\",\"value\":3}]]","expectedOutput":"{\"arr\":[1,2,3]}"}]'
WHERE id ='json-transformer';

-- ============================================================
-- 6. recursive-tree-traversal (JavaScript)
--    Function: treeDiff(a, b)
--    Input: JSON array [treeA, treeB]
--    Output: JSON diff object {added, removed, changed}
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());console.log(JSON.stringify(treeDiff(_a[0],_a[1])));});',
  test_cases = '[{"input":"[{\"val\":\"root\",\"children\":[{\"val\":\"a\",\"children\":[]}]},{\"val\":\"root\",\"children\":[{\"val\":\"a\",\"children\":[]}]}]","expectedOutput":"{\"added\":[],\"removed\":[],\"changed\":[]}"},{"input":"[{\"val\":\"old\",\"children\":[]},{\"val\":\"new\",\"children\":[]}]","expectedOutput":"{\"added\":[],\"removed\":[],\"changed\":[{\"path\":[],\"from\":\"old\",\"to\":\"new\"}]}"},{"input":"[{\"val\":\"root\",\"children\":[]},{\"val\":\"root\",\"children\":[{\"val\":\"new-child\",\"children\":[]}]}]","expectedOutput":"{\"added\":[[0]],\"removed\":[],\"changed\":[]}"}]',
  hidden_test_cases = '[{"input":"[{\"val\":\"root\",\"children\":[{\"val\":\"old-child\",\"children\":[]}]},{\"val\":\"root\",\"children\":[]}]","expectedOutput":"{\"added\":[],\"removed\":[[0]],\"changed\":[]}"},{"input":"[{\"val\":\"r\",\"children\":[{\"val\":\"a\",\"children\":[{\"val\":\"x\",\"children\":[]}]}]},{\"val\":\"r\",\"children\":[{\"val\":\"a\",\"children\":[{\"val\":\"y\",\"children\":[]}]}]}]","expectedOutput":"{\"added\":[],\"removed\":[],\"changed\":[{\"path\":[0,0],\"from\":\"x\",\"to\":\"y\"}]}"}]'
WHERE id ='recursive-tree-traversal';

-- ============================================================
-- 7. translate-and-extend (JavaScript)
--    Functions: daysBetween, addDays, dayOfWeek, isWeekend, addBusinessDays
--    Input: JSON array [functionName, ...args]
--    Output: JSON result
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _d=JSON.parse(_i.trim());const _fns={daysBetween,addDays,dayOfWeek,isWeekend,addBusinessDays};console.log(JSON.stringify(_fns[_d[0]](..._d.slice(1))));});',
  test_cases = '[{"input":"[\"daysBetween\",\"2024-01-01\",\"2024-01-31\"]","expectedOutput":"30"},{"input":"[\"addDays\",\"2024-01-15\",10]","expectedOutput":"\"2024-01-25\""},{"input":"[\"addDays\",\"2024-01-15\",-5]","expectedOutput":"\"2024-01-10\""},{"input":"[\"dayOfWeek\",\"2024-01-15\"]","expectedOutput":"0"},{"input":"[\"isWeekend\",\"2024-01-13\"]","expectedOutput":"true"},{"input":"[\"addBusinessDays\",\"2024-01-15\",5]","expectedOutput":"\"2024-01-22\""},{"input":"[\"addBusinessDays\",\"2024-01-19\",1]","expectedOutput":"\"2024-01-22\""}]',
  hidden_test_cases = '[{"input":"[\"addBusinessDays\",\"2024-01-22\",-1]","expectedOutput":"\"2024-01-19\""},{"input":"[\"addBusinessDays\",\"2024-01-21\",-1]","expectedOutput":"\"2024-01-19\""}]'
WHERE id ='translate-and-extend';

-- ============================================================
-- 8. url-parser / globMatch (JavaScript)
--    Function: globMatch(pattern, path)
--    Input: JSON array [pattern, path]
--    Output: JSON boolean
--    Split multi-call scenarios into individual test cases
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'let _i='''';process.stdin.on(''data'',d=>_i+=d);process.stdin.on(''end'',()=>{const _a=JSON.parse(_i.trim());console.log(JSON.stringify(globMatch(_a[0],_a[1])));});',
  test_cases = '[{"input":"[\"src/app.js\",\"src/app.js\"]","expectedOutput":"true"},{"input":"[\"src/*.js\",\"src/app.js\"]","expectedOutput":"true"},{"input":"[\"src/*.js\",\"src/lib/app.js\"]","expectedOutput":"false"},{"input":"[\"src/**/*.js\",\"src/lib/app.js\"]","expectedOutput":"true"},{"input":"[\"file?.txt\",\"file1.txt\"]","expectedOutput":"true"},{"input":"[\"file?.txt\",\"file12.txt\"]","expectedOutput":"false"},{"input":"[\"[abc].txt\",\"a.txt\"]","expectedOutput":"true"},{"input":"[\"[abc].txt\",\"d.txt\"]","expectedOutput":"false"}]',
  hidden_test_cases = '[{"input":"[\"[!abc].txt\",\"d.txt\"]","expectedOutput":"true"},{"input":"[\"[!abc].txt\",\"a.txt\"]","expectedOutput":"false"},{"input":"[\"**/*.test.[jt]s\",\"src/components/Button.test.js\"]","expectedOutput":"true"}]'
WHERE id ='url-parser';

-- ============================================================
-- 9. data-sql-aggregator (Python)
--    Function: aggregate(data, group_by, aggregations)
--    Input: JSON array [data, group_by, aggregations]
--    Output: JSON result list (sorted by group key for determinism)
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'import json,sys;_a=json.loads(sys.stdin.read().strip());r=aggregate(_a[0],_a[1],_a[2]);print(json.dumps(sorted(r,key=lambda x:str(x.get(_a[1],'''')))))',
  test_cases = '[{"input":"[[{\"dept\":\"eng\",\"name\":\"Alice\"},{\"dept\":\"eng\",\"name\":\"Bob\"},{\"dept\":\"sales\",\"name\":\"Charlie\"}],\"dept\",{\"headcount\":{\"func\":\"count\",\"field\":\"name\"}}]","expectedOutput":"[{\"dept\": \"eng\", \"headcount\": 2}, {\"dept\": \"sales\", \"headcount\": 1}]"},{"input":"[[{\"dept\":\"eng\",\"salary\":100000},{\"dept\":\"eng\",\"salary\":120000},{\"dept\":\"sales\",\"salary\":80000}],\"dept\",{\"total_salary\":{\"func\":\"sum\",\"field\":\"salary\"},\"avg_salary\":{\"func\":\"avg\",\"field\":\"salary\"}}]","expectedOutput":"[{\"dept\": \"eng\", \"total_salary\": 220000, \"avg_salary\": 110000.0}, {\"dept\": \"sales\", \"total_salary\": 80000, \"avg_salary\": 80000.0}]"},{"input":"[[{\"dept\":\"eng\",\"age\":25},{\"dept\":\"eng\",\"age\":35},{\"dept\":\"eng\",\"age\":30}],\"dept\",{\"youngest\":{\"func\":\"min\",\"field\":\"age\"},\"oldest\":{\"func\":\"max\",\"field\":\"age\"}}]","expectedOutput":"[{\"dept\": \"eng\", \"youngest\": 25, \"oldest\": 35}]"}]',
  hidden_test_cases = '[{"input":"[[{\"dept\":\"eng\",\"bonus\":5000},{\"dept\":\"eng\",\"bonus\":null},{\"dept\":\"eng\",\"bonus\":3000}],\"dept\",{\"total_bonus\":{\"func\":\"sum\",\"field\":\"bonus\"},\"bonus_count\":{\"func\":\"count\",\"field\":\"bonus\"},\"avg_bonus\":{\"func\":\"avg\",\"field\":\"bonus\"}}]","expectedOutput":"[{\"dept\": \"eng\", \"total_bonus\": 8000, \"bonus_count\": 2, \"avg_bonus\": 4000.0}]"},{"input":"[[{\"dept\":\"eng\",\"bonus\":null},{\"dept\":\"eng\",\"bonus\":null}],\"dept\",{\"total\":{\"func\":\"sum\",\"field\":\"bonus\"},\"average\":{\"func\":\"avg\",\"field\":\"bonus\"}}]","expectedOutput":"[{\"dept\": \"eng\", \"total\": 0, \"average\": null}]"}]'
WHERE id ='data-sql-aggregator';

-- ============================================================
-- 10. py-config-parser (Python)
--     Function: parse_ini(text)
--     Input: raw INI text (not JSON — passed as stdin directly)
--     Output: JSON parsed config dict
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'import json,sys;print(json.dumps(parse_ini(sys.stdin.read().strip()),sort_keys=True))',
  test_cases = '[{"input":"[server]\nhost = localhost\nport = 8080","expectedOutput":"{\"server\": {\"host\": \"localhost\", \"port\": \"8080\"}}"},{"input":"[database]\n# This is a comment\nhost = db.example.com\n# Another comment\nport = 5432","expectedOutput":"{\"database\": {\"host\": \"db.example.com\", \"port\": \"5432\"}}"},{"input":"[logging]\nformat = %(asctime)s\n  %(levelname)s\n  %(message)s\nlevel = DEBUG","expectedOutput":"{\"logging\": {\"format\": \"%(asctime)s %(levelname)s %(message)s\", \"level\": \"DEBUG\"}}"}]',
  hidden_test_cases = '[{"input":"[empty]\n[notempty]\nkey = val","expectedOutput":"{\"empty\": {}, \"notempty\": {\"key\": \"val\"}}"}]'
WHERE id ='py-config-parser';

-- ============================================================
-- 11. py-csv-transformer (Python)
--     Function: transform_csv(csv_str, renames, type_conversions, filters)
--     Input: JSON array [csv_str, opts]
--     Output: transformed CSV string
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'import json,sys;_a=json.loads(sys.stdin.read().strip());print(transform_csv(_a[0],renames=_a[1] if len(_a)>1 else None,type_conversions=_a[2] if len(_a)>2 else None,filters=_a[3] if len(_a)>3 else None))',
  test_cases = '[{"input":"[\"name,age,city\\nAlice,30,NYC\\nBob,25,LA\",{\"name\":\"full_name\",\"age\":\"years\"},null,null]","expectedOutput":"full_name,years,city\nAlice,30,NYC\nBob,25,LA"},{"input":"[\"item,price,qty\\nWidget,10,5\\nGadget,25,3\",null,{\"price\":\"int\",\"qty\":\"int\"},null]","expectedOutput":"item,price,qty\nWidget,10,5\nGadget,25,3"},{"input":"[\"name,age\\nAlice,30\\nBob,15\\nCharlie,22\\nDiana,12\",null,null,[{\"column\":\"age\",\"op\":\">=\",\"value\":18}]]","expectedOutput":"name,age\nAlice,30\nCharlie,22"}]',
  hidden_test_cases = '[{"input":"[\"name,city\\n\\\"Smith, John\\\",\\\"New York, NY\\\"\\nJane,Boston\",null,null,null]","expectedOutput":"name,city\n\"Smith, John\",\"New York, NY\"\nJane,Boston"}]'
WHERE id ='py-csv-transformer';

-- ============================================================
-- 12. py-dependency-resolver (Python)
--     Function: resolve_dependencies(deps)
--     Input: JSON deps dict
--     Output: JSON sorted list or error dict
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'import json,sys;print(json.dumps(resolve_dependencies(json.loads(sys.stdin.read().strip()))))',
  test_cases = '[{"input":"{\"c\":[\"b\"],\"b\":[\"a\"],\"a\":[]}","expectedOutput":"[\"a\", \"b\", \"c\"]"},{"input":"{\"app\":[\"left\",\"right\"],\"left\":[\"base\"],\"right\":[\"base\"],\"base\":[]}","expectedOutput":"[\"base\", \"left\", \"right\", \"app\"]"},{"input":"{\"a\":[\"b\"],\"b\":[\"c\"],\"c\":[\"a\"]}","expectedOutput":"{\"error\": \"cycle\", \"cycle\": [\"a\", \"b\", \"c\", \"a\"]}"}]',
  hidden_test_cases = '[{"input":"{\"zlib\":[],\"curl\":[],\"make\":[],\"gcc\":[]}","expectedOutput":"[\"curl\", \"gcc\", \"make\", \"zlib\"]"},{"input":"{\"web-app\":[\"api\",\"ui-lib\"],\"api\":[\"db-driver\",\"auth\"],\"ui-lib\":[\"core\"],\"db-driver\":[\"core\"],\"auth\":[\"core\",\"crypto\"],\"core\":[],\"crypto\":[]}","expectedOutput":"[\"core\", \"crypto\", \"auth\", \"db-driver\", \"ui-lib\", \"api\", \"web-app\"]"}]'
WHERE id ='py-dependency-resolver';

-- ============================================================
-- 13. py-log-analyzer (Python)
--     Functions: parse_logs, count_levels, error_rate
--     Input: JSON array [function_name, log_text]
--     Output: JSON result
-- ============================================================
UPDATE challenges SET
  use_stdin = 1,
  test_harness = 'import json,sys;_d=json.loads(sys.stdin.read().strip());_fns={''parse_logs'':parse_logs,''count_levels'':count_levels,''error_rate'':error_rate};print(json.dumps(_fns[_d[0]](_d[1])))',
  test_cases = '[{"input":"[\"parse_logs\",\"2024-01-15 10:30:00 INFO [auth] User login successful\\n2024-01-15 10:30:05 ERROR [db] Connection timeout\\n2024-01-15 10:30:10 WARN [cache] Cache miss for key=user:42\"]","expectedOutput":"[{\"timestamp\": \"2024-01-15 10:30:00\", \"level\": \"INFO\", \"component\": \"auth\", \"message\": \"User login successful\"}, {\"timestamp\": \"2024-01-15 10:30:05\", \"level\": \"ERROR\", \"component\": \"db\", \"message\": \"Connection timeout\"}, {\"timestamp\": \"2024-01-15 10:30:10\", \"level\": \"WARN\", \"component\": \"cache\", \"message\": \"Cache miss for key=user:42\"}]"},{"input":"[\"count_levels\",\"2024-01-15 10:00:00 INFO [app] Started\\n2024-01-15 10:00:01 INFO [app] Ready\\n2024-01-15 10:00:02 ERROR [db] Timeout\\n2024-01-15 10:00:03 WARN [cache] Stale\\n2024-01-15 10:00:04 ERROR [auth] Failed\\n2024-01-15 10:00:05 DEBUG [app] Tick\"]","expectedOutput":"{\"DEBUG\": 1, \"ERROR\": 2, \"INFO\": 2, \"WARN\": 1}"},{"input":"[\"error_rate\",\"2024-01-15 10:00:00 INFO [app] OK\\n2024-01-15 10:00:01 ERROR [db] Fail\\n2024-01-15 10:00:02 INFO [app] OK\\n2024-01-15 10:00:03 FATAL [app] Crash\\n2024-01-15 10:00:04 INFO [app] OK\\n2024-01-15 10:00:05 INFO [app] OK\\n2024-01-15 10:00:06 INFO [app] OK\\n2024-01-15 10:00:07 ERROR [db] Fail\\n2024-01-15 10:00:08 INFO [app] OK\\n2024-01-15 10:00:09 INFO [app] OK\"]","expectedOutput":"0.3"}]',
  hidden_test_cases = '[{"input":"[\"parse_logs\",\"2024-01-15 10:00:00 INFO [app] Starting\\n2024-01-15 10:00:01 ERROR [db] Connection failed\\n  at connect (db.py:42)\\n  at init (app.py:10)\\n2024-01-15 10:00:02 INFO [app] Retrying\"]","expectedOutput":"[{\"timestamp\": \"2024-01-15 10:00:00\", \"level\": \"INFO\", \"component\": \"app\", \"message\": \"Starting\"}, {\"timestamp\": \"2024-01-15 10:00:01\", \"level\": \"ERROR\", \"component\": \"db\", \"message\": \"Connection failed\", \"stack_trace\": [\"at connect (db.py:42)\", \"at init (app.py:10)\"]}, {\"timestamp\": \"2024-01-15 10:00:02\", \"level\": \"INFO\", \"component\": \"app\", \"message\": \"Retrying\"}]"}]'
WHERE id ='py-log-analyzer';
