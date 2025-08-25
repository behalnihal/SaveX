export default function Footer() {
  return (
    <div className="relative w-full flex justify-center py-6">
      <footer className="backdrop-blur-lg bg-white/10 dark:bg-slate-900/10 shadow-2xl border border-white/20 dark:border-slate-700/20 rounded-2xl py-6 px-6 w-full max-w-3xl mx-4 text-center floating-footer">
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">
          SaveX - Your trusted video downloader
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 font-light mb-4">
          © 2025 SaveX. Built with ❤️ for content creators and viewers.
        </p>
        <div className="flex justify-center items-center space-x-6">
          <span className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer transition-colors duration-200">
            Privacy
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer transition-colors duration-200">
            Terms
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer transition-colors duration-200">
            Support
          </span>
        </div>
      </footer>
    </div>
  );
}
