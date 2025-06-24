import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="backdrop-blur-md bg-white/70 shadow-md border border-gray-200 rounded-b-xl px-8 py-4 flex justify-center items-center w-full">
      <Link href="/">
        <span className="text-2xl font-extrabold text-blue-600 tracking-tight drop-shadow-sm">
          SaveX
        </span>
      </Link>
    </nav>
  );
}
