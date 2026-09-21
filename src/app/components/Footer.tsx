import pkg from '../../../package.json';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-white/5 backdrop-blur-sm py-6">
      <div className="container mx-auto px-6 text-center">
        <p className="text-sm text-white/60">
          NavBox <span className="text-white/40">v{pkg.version}</span>
        </p>
      </div>
    </footer>
  );
}
