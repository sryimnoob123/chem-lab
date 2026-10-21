/** Dev Dock 用到的数据形状（客户端，只从 /api/experiments 与 /api/runs/:id 来） */

export interface DockExperiment {
  id: string;
  title: string;
  steps: number;
}

export interface DockRun {
  runId: string;
  experimentId: string;
  status: string;
}

export interface DockStudent {
  studentNo: string;
  name: string;
  className: string;
}
