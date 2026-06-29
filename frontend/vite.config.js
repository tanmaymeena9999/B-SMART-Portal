import { defineConfig } from 'vite';

// Multi-page app: each HTML file in /pages acts as an entry.
export default defineConfig({
    root: '.',
    publicDir: 'assets',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                index: './index.html',
                login: './pages/login/login.html',
                dashboard: './pages/dashboard/dashboard.html',
                'access-credentials': './pages/access-credentials/access-credentials.html',
                'retail-service-report': './pages/retail-service-report/retail-service-report.html',
                'monthly-report': './pages/monthly-report/monthly-report.html',
                'additional-kpi': './pages/additional-kpi/additional-kpi.html',
                'vin-retention': './pages/vin-retention/vin-retention.html',
                'view-report': './pages/view-report/view-report.html'
            }
        }
    }
});
