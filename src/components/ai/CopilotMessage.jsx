import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ActionPlanPanel from "./ActionPlanPanel";

const markdownComponents = {
  p: (props) => <p className="mb-1.5 last:mb-0" {...props} />,
  strong: (props) => <strong className="font-semibold text-darkblack-700 dark:text-white" {...props} />,
  ul: (props) => <ul className="list-disc list-outside pl-4 space-y-0.5 mb-1.5 marker:text-bgray-400" {...props} />,
  ol: (props) => <ol className="list-decimal list-outside pl-4 space-y-0.5 mb-1.5" {...props} />,
  li: (props) => <li {...props} />,
  code: (props) => <code className="px-1 py-0.5 bg-black/5 dark:bg-white/10 rounded text-xs font-mono" {...props} />,
  a: (props) => <a className="text-primary hover:underline" target="_blank" rel="noreferrer" {...props} />,
};

export default function CopilotMessage({ message, bubbleClassName = "" }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className={`max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm bg-primary text-white text-sm ${bubbleClassName}`}>{message.content}</div>
      </div>
    );
  }
  return (
    <div className="flex justify-start mb-3">
      <div className={`max-w-[90%] w-full ${bubbleClassName}`}>
        {message.content && (
          <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-bgray-100 dark:bg-darkblack-500 text-darkblack-700 dark:text-white text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown>
          </div>
        )}
        {message.plan && <ActionPlanPanel plan={message.plan} onDone={message.onPlanDone} />}
      </div>
    </div>
  );
}
