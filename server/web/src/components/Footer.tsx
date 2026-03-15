export default function Footer() {
  return (
    <footer className="border-t border-border py-6 text-center text-dim text-sm">
      <div className="max-w-[960px] mx-auto px-6">
        <p>&copy; {new Date().getFullYear()} negative-support</p>
      </div>
    </footer>
  );
}
