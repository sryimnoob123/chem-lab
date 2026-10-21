import { redirect } from "next/navigation";
import { getStudent } from "@/lib/session";
import { PlanDesigner } from "./designer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "进阶学习 · 无机及分析化学实验" };

export default async function PlanPage() {
  const student = await getStudent();
  if (!student) redirect("/login");
  return <PlanDesigner studentNo={student.studentNo} />;
}
