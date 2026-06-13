import { useMemo, useState } from 'react';
import type { StoreProduct } from '../../../lib/api';
import './ProductsTab.scss';

interface Facet {
  /** category_slug, or 'all' for the catch-all chip. */
  slug: string;
  label: string;
  emoji: string;
  count: number;
}

interface ProductsTabProps {
  products: StoreProduct[];
}

/**
 * Products tab for the detail sheet: a search box, a horizontally-scrolling
 * category facet carousel, and the filtered list. All filtering is client-side
 * over the already-fetched catalog — no extra API calls.
 */
const ProductsTab: React.FC<ProductsTabProps> = ({ products }) => {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

  // One facet per category (first-seen order), plus a leading "ALL" chip.
  const facets = useMemo<Facet[]>(() => {
    const byCat = new Map<string, Facet>();
    for (const p of products) {
      const existing = byCat.get(p.category_slug);
      if (existing) existing.count += 1;
      else
        byCat.set(p.category_slug, {
          slug: p.category_slug,
          label: p.category,
          emoji: p.emoji,
          count: 1,
        });
    }
    return [
      { slug: 'all', label: 'ALL', emoji: '', count: products.length },
      ...byCat.values(),
    ];
  }, [products]);

  // Reset to ALL if the active facet vanished (e.g. a different store loaded).
  const activeCat = facets.some((f) => f.slug === cat) ? cat : 'all';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCat !== 'all' && p.category_slug !== activeCat) return false;
      if (q && !`${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCat, query]);

  return (
    <div className="products-tab">
      <input
        className="products-tab__search"
        type="search"
        placeholder="Search products..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="products-tab__facets">
        {facets.map((f) => (
          <button
            key={f.slug}
            type="button"
            className={`products-tab__facet${
              activeCat === f.slug ? ' products-tab__facet--active' : ''
            }`}
            onClick={() => setCat(f.slug)}
          >
            {f.emoji && <span className="products-tab__facet-emoji">{f.emoji}</span>}
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="products-tab__list">
        {filtered.map((p) => (
          <div key={p.product_id} className="products-tab__item">
            <div className="products-tab__item-main">
              <p className="products-tab__item-name">{p.name}</p>
              <p className="products-tab__item-cat">
                {p.emoji} {p.description || p.friendly_category}
              </p>
            </div>
            {p.price_cents ? (
              <span className="products-tab__item-price">{p.price_raw}</span>
            ) : null}
          </div>
        ))}
        {filtered.length === 0 && <p className="products-tab__empty">No products match.</p>}
      </div>
    </div>
  );
};

export default ProductsTab;
