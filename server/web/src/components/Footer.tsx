export default function Footer() {
  return (
    <footer className="border-t border-border py-5 text-center">
      <div className="max-w-[1100px] mx-auto px-6">
        <p className="font-mono text-[10px] tracking-[0.08em] text-primary/20">&copy; {new Date().getFullYear()} negative-support</p>
      </div>
    </footer>
  );
}
