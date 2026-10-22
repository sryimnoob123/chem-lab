// 临时诊断脚本：只打印 eslint 的 error（severity=2），避免终端聚合把明细吞掉
const { ESLint } = require("eslint");

(async () => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const results = await eslint.lintFiles(["app", "components", "lib", "experiments"]);
  let errors = 0;
  for (const file of results) {
    for (const message of file.messages) {
      if (message.severity !== 2) continue;
      errors += 1;
      const rel = file.filePath.replace(/\\/g, "/").split("chem-lab/")[1] ?? file.filePath;
      console.log(`ERROR ${rel}:${message.line}:${message.column} ${message.ruleId} :: ${message.message}`);
    }
  }
  console.log(`TOTAL_ERRORS=${errors}`);
})();
