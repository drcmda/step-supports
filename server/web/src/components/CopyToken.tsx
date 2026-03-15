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
    <div className="flex items-center gap-3 rounded-xl p-4 max-w-[500px] mx-auto my-4 border border-accent/20 bg-accent-glow">
      <code className="font-mono text-xs text-accent flex-1 break-all">{token}</code>
      <button
        className="bg-accent text-base border-none px-4 py-2 rounded-lg cursor-pointer text-sm font-medium whitespace-nowrap hover:brightness-110 transition-all"
        onClick={handleCopy}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
