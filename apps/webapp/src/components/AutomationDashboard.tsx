import React, { useState, useEffect } from 'react';

interface SystemStatus {
  sites: { total: number; enabled: number };
  articles: { total: number; pending_transformation: number; transformed: number };
  transformations: { total: number };
  deployments: { total: number; active: number };
  creators: { total: number };
}

interface ScheduleStatus {
  isRunning: boolean;
  config: {
    scrapeIntervalMinutes: number;
    transformIntervalMinutes: number;
    maxArticlesPerScrape: number;
    maxArticlesPerTransform: number;
  };
  nextRun: string | null;
}

interface PipelineStats {
  pipeline_runs: { last_24h: number; last_7d: number; errors_24h: number };
  articles_scraped: { last_24h: number; last_7d: number };
  transformations_created: { last_24h: number; last_7d: number };
}

export default function AutomationDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const [systemRes, scheduleRes] = await Promise.all([
        fetch('/api/automation/status'),
        fetch('/api/automation/schedule/status')
      ]);

      if (systemRes.ok) {
        const systemData = await systemRes.json();
        setSystemStatus(systemData.system_status);
      }

      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setScheduleStatus(scheduleData.schedule_status);
        setStats(scheduleData.statistics);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const runPipeline = async (type: 'scrape' | 'transform' | 'full-pipeline') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/automation/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Success: ${result.message}`);
        await fetchStatus(); // Refresh status
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (action: 'start' | 'stop') => {
    try {
      setLoading(true);
      const response = await fetch(`/api/automation/schedule/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Success: ${result.message}`);
        await fetchStatus(); // Refresh status
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !systemStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading automation dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Trust Assembly - Phase 1 Automation
        </h1>
        <p className="text-gray-600">
          Automated headline transformation pipeline for predetermined news sites
        </p>
      </div>

      {/* System Status Cards */}
      {systemStatus && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatusCard
            title="News Sites"
            value={`${systemStatus.sites.enabled} / ${systemStatus.sites.total}`}
            label="Enabled Sites"
            color="blue"
          />
          <StatusCard
            title="Articles"
            value={systemStatus.articles.total.toString()}
            label={`${systemStatus.articles.pending_transformation} pending transformation`}
            color="green"
          />
          <StatusCard
            title="Transformations"
            value={systemStatus.transformations.total.toString()}
            label={`${systemStatus.deployments.active} active deployments`}
            color="purple"
          />
        </div>
      )}

      {/* Schedule Status */}
      {scheduleStatus && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Automation Schedule
            </h2>
            <div className="flex space-x-2">
              <button
                onClick={() => toggleSchedule(scheduleStatus.isRunning ? 'stop' : 'start')}
                disabled={loading}
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  scheduleStatus.isRunning
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:opacity-50`}
              >
                {scheduleStatus.isRunning ? 'Stop' : 'Start'} Automation
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  scheduleStatus.isRunning ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="font-medium">
                  Status: {scheduleStatus.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              {scheduleStatus.nextRun && (
                <div className="text-sm text-gray-600">
                  Next run: {new Date(scheduleStatus.nextRun).toLocaleString()}
                </div>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div>Scrape interval: {scheduleStatus.config.scrapeIntervalMinutes} minutes</div>
              <div>Transform interval: {scheduleStatus.config.transformIntervalMinutes} minutes</div>
              <div>Max articles per scrape: {scheduleStatus.config.maxArticlesPerScrape}</div>
              <div>Max articles per transform: {scheduleStatus.config.maxArticlesPerTransform}</div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Activity Statistics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {stats.pipeline_runs.last_24h}
              </div>
              <div className="text-sm text-gray-600">Pipeline runs (24h)</div>
              {stats.pipeline_runs.errors_24h > 0 && (
                <div className="text-xs text-red-600 mt-1">
                  {stats.pipeline_runs.errors_24h} errors
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.articles_scraped.last_24h}
              </div>
              <div className="text-sm text-gray-600">Articles scraped (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {stats.transformations_created.last_24h}
              </div>
              <div className="text-sm text-gray-600">Transformations (24h)</div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Controls */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Manual Pipeline Controls
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => runPipeline('scrape')}
            disabled={loading}
            className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            Scrape Articles
          </button>
          <button
            onClick={() => runPipeline('transform')}
            disabled={loading}
            className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            Transform Headlines
          </button>
          <button
            onClick={() => runPipeline('full-pipeline')}
            disabled={loading}
            className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            Full Pipeline
          </button>
        </div>
      </div>

      {/* Refresh button */}
      <div className="text-center">
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>
    </div>
  );
}

interface StatusCardProps {
  title: string;
  value: string;
  label: string;
  color: 'blue' | 'green' | 'purple';
}

function StatusCard({ title, value, label, color }: StatusCardProps) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50'
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <div className={`text-3xl font-bold ${colorClasses[color].split(' ')[0]} mb-1`}>
        {value}
      </div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}