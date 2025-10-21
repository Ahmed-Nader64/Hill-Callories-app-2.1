import { useEffect } from 'react';

export const PerformanceMonitor = () => {
  useEffect(() => {
    // Monitor Core Web Vitals with dynamic import
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS((metric) => {
        console.log('CLS:', metric);
      });
      
      getFID((metric) => {
        console.log('FID:', metric);
      });
      
      getFCP((metric) => {
        console.log('FCP:', metric);
      });
      
      getLCP((metric) => {
        console.log('LCP:', metric);
      });
      
      getTTFB((metric) => {
        console.log('TTFB:', metric);
      });
    }).catch((error) => {
      console.log('Web Vitals not available:', error);
    });

    // Monitor bundle size in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance monitoring enabled');
    }
  }, []);

  return null;
};
