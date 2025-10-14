// Performance monitoring and error tracking for mobile app
import { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Performance metrics interface
export interface PerformanceMetrics {
  screenLoadTime: number;
  firebaseQueryTime: number;
  imageLoadTime: number;
  errorCount: number;
  crashCount: number;
  memoryUsage?: number;
  networkRequests: number;
  slowOperations: string[];
}

// Error tracking interface
export interface ErrorInfo {
  id: string;
  timestamp: number;
  message: string;
  stack?: string;
  component?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

// Performance monitor class
class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private errors: ErrorInfo[];
  private startTimes: Map<string, number>;
  private isEnabled: boolean;

  constructor() {
    this.metrics = {
      screenLoadTime: 0,
      firebaseQueryTime: 0,
      imageLoadTime: 0,
      errorCount: 0,
      crashCount: 0,
      networkRequests: 0,
      slowOperations: []
    };
    this.errors = [];
    this.startTimes = new Map();
    this.isEnabled = __DEV__; // Only enabled in development by default
  }

  // Enable/disable monitoring
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  // Start timing an operation
  startTimer(operation: string) {
    if (!this.isEnabled) return;
    this.startTimes.set(operation, Date.now());
  }

  // End timing an operation and record metrics
  endTimer(operation: string, threshold: number = 1000) {
    if (!this.isEnabled) return;

    const startTime = this.startTimes.get(operation);
    if (!startTime) return;

    const duration = Date.now() - startTime;
    this.startTimes.delete(operation);

    // Record in appropriate metric
    switch (operation) {
      case 'screenLoad':
        this.metrics.screenLoadTime = duration;
        break;
      case 'firebaseQuery':
        this.metrics.firebaseQueryTime = duration;
        break;
      case 'imageLoad':
        this.metrics.imageLoadTime = duration;
        break;
    }

    // Track slow operations
    if (duration > threshold) {
      this.metrics.slowOperations.push(`${operation}:${duration}ms`);
      if (this.metrics.slowOperations.length > 10) {
        this.metrics.slowOperations.shift(); // Keep only latest 10
      }
    }
  }

  // Record an error
  recordError(error: Error, component?: string, severity: ErrorInfo['severity'] = 'medium') {
    if (!this.isEnabled) return;

    const errorInfo: ErrorInfo = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      component,
      severity,
      context: {
        userAgent: 'React Native',
        platform: 'mobile'
      }
    };

    this.errors.push(errorInfo);
    this.metrics.errorCount++;

    // Keep only latest 50 errors
    if (this.errors.length > 50) {
      this.errors.shift();
    }

    // Log to console in development
    if (__DEV__) {
      console.error(`🚨 [PerformanceMonitor] Error in ${component}:`, error.message);
    }
  }

  // Record network request
  recordNetworkRequest() {
    if (!this.isEnabled) return;
    this.metrics.networkRequests++;
  }

  // Record memory usage (if available)
  recordMemoryUsage() {
    if (!this.isEnabled) return;

    // This would need to be implemented based on the specific memory monitoring approach
    // For now, we'll leave it as a placeholder
    // this.metrics.memoryUsage = getMemoryUsage();
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Get recent errors
  getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  // Clear metrics
  clearMetrics() {
    this.metrics = {
      screenLoadTime: 0,
      firebaseQueryTime: 0,
      imageLoadTime: 0,
      errorCount: 0,
      crashCount: 0,
      networkRequests: 0,
      slowOperations: []
    };
    this.errors = [];
  }

  // Export metrics for debugging
  exportMetrics() {
    return {
      metrics: this.metrics,
      errors: this.errors,
      timestamp: Date.now()
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = (componentName: string) => {
  const componentRef = useRef<string>(componentName);
  const screenStartTime = useRef<number>(0);

  // Record component mount time
  useEffect(() => {
    screenStartTime.current = Date.now();

    return () => {
      // Record screen load time when component unmounts
      if (screenStartTime.current) {
        const loadTime = Date.now() - screenStartTime.current;
        performanceMonitor.endTimer('screenLoad');

        if (__DEV__) {
          console.log(`📱 [Performance] ${componentRef.current} loaded in ${loadTime}ms`);
        }
      }
    };
  }, []);

  // Error boundary for the component
  const recordError = useCallback((error: Error, errorInfo?: any) => {
    performanceMonitor.recordError(error, componentRef.current, 'medium');
  }, []);

  // Start timing operations
  const startTimer = useCallback((operation: string) => {
    performanceMonitor.startTimer(operation);
  }, []);

  const endTimer = useCallback((operation: string, threshold?: number) => {
    performanceMonitor.endTimer(operation, threshold);
  }, []);

  return {
    recordError,
    startTimer,
    endTimer,
    getMetrics: () => performanceMonitor.getMetrics()
  };
};

// Firebase query performance tracking
export const trackFirebaseQuery = async <T>(
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const startTime = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    performanceMonitor.endTimer('firebaseQuery', 500); // Log if > 500ms

    if (__DEV__ && duration > 1000) {
      console.warn(`🐌 [Firebase] Slow query "${operation}" took ${duration}ms`);
    }

    return result;
  } catch (error) {
    performanceMonitor.recordError(error as Error, `Firebase:${operation}`, 'high');
    throw error;
  }
};

// Image load performance tracking
export const trackImageLoad = (imageUrl: string, onLoad?: () => void) => {
  return {
    onLoadStart: () => {
      performanceMonitor.startTimer('imageLoad');
    },
    onLoadEnd: () => {
      performanceMonitor.endTimer('imageLoad');
      onLoad?.();
    },
    onError: (error: any) => {
      performanceMonitor.recordError(new Error(`Image load failed: ${imageUrl}`), 'ImageLoad', 'low');
    }
  };
};

// AsyncStorage persistence for offline metrics
export const saveMetricsToStorage = async () => {
  try {
    const metrics = performanceMonitor.exportMetrics();
    await AsyncStorage.setItem('@performance_metrics', JSON.stringify(metrics));
  } catch (error) {
    console.error('Failed to save metrics to storage:', error);
  }
};

export const loadMetricsFromStorage = async () => {
  try {
    const stored = await AsyncStorage.getItem('@performance_metrics');
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load metrics from storage:', error);
    return null;
  }
};

// Development utilities
export const logPerformanceReport = () => {
  if (!__DEV__) return;

  const metrics = performanceMonitor.getMetrics();
  const errors = performanceMonitor.getErrors();

  console.group('📊 Performance Report');
  console.log('Metrics:', metrics);
  console.log('Recent Errors:', errors.slice(-5)); // Show last 5 errors
  console.groupEnd();
};

// Export for debugging in development
if (__DEV__) {
  (global as any).performanceMonitor = performanceMonitor;
  (global as any).logPerformanceReport = logPerformanceReport;
}
