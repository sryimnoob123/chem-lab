-- 学生白名单种子（幂等）：与 db/seed-demo.mjs 口径一致，学号 20250101 为验收账号
INSERT INTO students (student_no, name, class_name) VALUES
('20250101', '周若曦', '化工 25-1 班')
ON CONFLICT (student_no) DO UPDATE SET name = EXCLUDED.name, class_name = EXCLUDED.class_name;
