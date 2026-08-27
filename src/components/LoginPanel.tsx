import Image from "next/image";
import Link from "next/link";
import loginLogo from "../app/loginLogo.png";

export default function LoginPanel() {
  return (
    <Link
      href="/login"
      className="rounded-lg flex items-center gap-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 pt-4 pb-3 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:outline-none w-full cursor-pointer"
    >
      <div className="flex h-8 w-8 mb-1 items-center justify-center rounded-md">
        <Image src={loginLogo} alt="Logo" />
      </div>
      <div className="flex flex-col items-start">
        <h1 className="text-sm font-bold leading-tight">Sign In</h1>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          Access your Account
        </p>
      </div>
    </Link>
  );
}