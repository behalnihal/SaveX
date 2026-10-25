import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export default function Navbar() {
  return (
    <header className="site-header">
      <nav aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="SaveX home">
          <Image src="/savex-dither.png" alt="" width={30} height={30} />
          <span>SaveX</span>
        </Link>
        <a className="source-link" href="https://github.com/behalnihal/SaveX" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={14} aria-hidden="true" /></a>
      </nav>
    </header>
  );
}
