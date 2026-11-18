import { Link } from 'react-router';
import { Logo } from '@/components/common';
import { BRAND } from '@/config/brand';
import { useCategories } from '@/hooks/useMeta';

export function Footer() {
  const { data: categories = [] } = useCategories();
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            {BRAND.tagline} A peer-to-peer rental marketplace starting in Jakarta and the greater Jabodetabek area.
          </p>
          <p className="mt-6 text-xs font-bold uppercase tracking-wide text-muted">Social</p>
          <p className="mt-2 text-sm text-muted">Instagram, TikTok and X accounts are launching soon.</p>
        </div>
        <FooterCol title="Explore">
          {categories.slice(0, 6).map((c) => (
            <FooterLink key={c.id} to={`/explore?category=${c.slug}`}>
              {c.name}
            </FooterLink>
          ))}
        </FooterCol>
        <FooterCol title="Rentora">
          <FooterLink to="/about">About</FooterLink>
          <FooterLink to="/listings/new">List your item</FooterLink>
          <FooterLink to="/help">Help Center</FooterLink>
          <FooterLink to="/contact">Contact</FooterLink>
        </FooterCol>
        <FooterCol title="Legal">
          <FooterLink to="/terms">Terms of Service</FooterLink>
          <FooterLink to="/privacy">Privacy Policy</FooterLink>
          <FooterLink to="/help#safety">Trust & Safety</FooterLink>
        </FooterCol>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. MVP demo — prices are fictional.
          </p>
          <p>Prices in Indonesian Rupiah (IDR). Payments are simulated in this version.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold">{title}</p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-sm text-muted transition-colors hover:text-ink">
        {children}
      </Link>
    </li>
  );
}
