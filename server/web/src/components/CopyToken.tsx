import { useState } from "react";

interface Props {
  token: string;
}

export default function CopyToken({ token }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-lg p-4 max-w-[500px] mx-auto my-4">
      <code className="font-mono text-sm text-green-500 flex-1 break-all">{token}</code>
      <button
        className="bg-blue-500 text-white border-none px-4 py-2 rounded-md cursor-pointer text-sm font-medium whitespace-nowrap hover:bg-blue-600"
        onClick={handleCopy}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
