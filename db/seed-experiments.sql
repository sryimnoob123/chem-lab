-- 实验目录种子数据（幂等）：与 db/init.mjs 的 SEED 一致
INSERT INTO experiments (id, title, summary, steps, hours, kind, playable, sort_order) VALUES
('exp01', '仪器的认领、天平使用及溶液配制', '洗涤、称量、定容、浓硫酸稀释', 7, 5, '验证', true, 1),
('exp02', '试剂级氯化钠制备', '除杂、过滤、蒸发结晶、产率', 8, 5, '验证', false, 2),
('exp03', '醋酸电离度和电离常数测定', '系列稀释、pH 计、Ka 计算', 7, 3, '验证', false, 3),
('exp04', '沉淀的生成与溶解平衡', '沉淀制备、离心、分步沉淀、转化', 8, 4, '综合', false, 4),
('exp05', '氧化还原反应和电化学', '原电池、盐桥、电动势', 8, 3, '验证', false, 5),
('exp06', '配合物的生成和性质', '配位平衡、螯合物、稳定性比较', 8, 3, '综合', false, 6),
('exp07', '常见阳离子的分离与鉴定（一）', '特征反应、分组分离、干扰排除', 8, 4, '验证', false, 7),
('exp08', '清点仪器，分析天平称量练习', '固定质量称量、递减法、记录规范', 7, 3, '验证', false, 8),
('exp09', '酸碱标准溶液的配制与浓度比较', '滴定管洗涤润洗、半滴与终点判定', 7, 3, '验证', true, 9),
('exp10', '盐酸标准溶液的标定与工业纯碱总碱度的测定', '基准物质标定、双指示剂法测总碱度', 8, 3, '设计', false, 10)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  steps = EXCLUDED.steps,
  hours = EXCLUDED.hours,
  kind = EXCLUDED.kind,
  playable = EXCLUDED.playable,
  sort_order = EXCLUDED.sort_order;
