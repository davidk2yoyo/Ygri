import React from "react";
import CasesBoard from "../components/cases/CasesBoard";

export default function CustomerAttentionPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-darkblack-700 dark:text-white">Customer attention</h1>
      <CasesBoard />
    </div>
  );
}
