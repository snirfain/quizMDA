/**
 * Image Optimization Utilities
 * Lazy loading, responsive images, WebP support
 * Hebrew: אופטימיזציה לתמונות
 */

/**
 * Lazy load image component
 */
export function LazyImage({ src, alt, ...props }) {
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState(false);
  const imgRef = React.useRef(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setLoaded(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} style={{ position: 'relative', ...props.style }}>
      {!loaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ color: '#9E9E9E' }}>טוען תמונה...</div>
        </div>
      )}
      {loaded && !error && (
        <img
          src={src}
          alt={alt || ''}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          {...props}
        />
      )}
      {error && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#757575'
        }}>
          שגיאה בטעינת תמונה
        </div>
      )}
    </div>
  );
}

/**
 * Get responsive image srcset
 */
export function getResponsiveSrcSet(baseSrc, sizes = [400, 800, 1200]) {
  return sizes
    .map(size => `${baseSrc}?w=${size} ${size}w`)
    .join(', ');
}

/**
 * Check WebP support
 */
export function supportsWebP() {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Get optimized image URL
 */
export function getOptimizedImageUrl(src, options = {}) {
  const { width, height, quality = 80, format } = options;
  const params = new URLSearchParams();
  
  if (width) params.append('w', width);
  if (height) params.append('h', height);
  params.append('q', quality);
  
  // Use WebP if supported
  if (format === 'auto' && supportsWebP()) {
    params.append('f', 'webp');
  } else if (format) {
    params.append('f', format);
  }

  return `${src}?${params.toString()}`;
}

/**
 * Preload image
 */
export function preloadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
