import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="backdrop-blur-md bg-white/70 shadow-md border border-gray-200 rounded-b-xl py-2 flex justify-center items-center w-full">
      <Link href="/" className="flex items-center">
        <Image src="/savex.png" alt="SaveX Logo" height={60} width={60}></Image>
        <span className="text-2xl font-extrabold text-blue-400 tracking-tight drop-shadow-sm">
          SaveX
        </span>
      </Link>
    </nav>
  );
}
