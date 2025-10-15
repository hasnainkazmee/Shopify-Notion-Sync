'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [shop, setShop] = useState('');
  const [connectionStatus, setConnectionStatus] = useState({
    shopify: false,
    notion: false,
  });
  const [syncResults, setSyncResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  // Check connection status on load
  useEffect(() => {
    checkConnections();
  }, []);

  const checkConnections = async () => {
    try {
      // Check Notion connection
      const notionRes = await fetch('/api/notion/products');
      const notionData = await notionRes.json();
      setConnectionStatus(prev => ({
        ...prev,
        notion: notionData.success,
      }));

      
      
      // Check if shop is connected (from localStorage or URL param)
      const params = new URLSearchParams(window.location.search);
      const connectedShop = params.get('shop');
      if (connectedShop) {
        setShop(connectedShop);
        setConnectionStatus(prev => ({
          ...prev,
          shopify: true,
        }));
        // Clean URL
        window.history.replaceState({}, document.title, '/');
      }
    } catch (error) {
      console.error('Error checking connections:', error);
    }
  };

  const startShopifyAuth = () => {
    const shopDomain = prompt('Enter your Shopify store domain (e.g., mystore.myshopify.com):');
    if (shopDomain) {
      window.location.href = `/api/auth/shopify?shop=${shopDomain}`;
    }
  };

  const runSync = async (syncType) => {
    if (!shop) {
      alert('Please connect your Shopify store first');
      return;
    }

    setLoading(true);
    setSyncResults(null);
    setLogs([]);

    try {
      addLog(`Starting ${syncType} sync...`);

      let endpoint = '';
      if (syncType === 'smart') {
        endpoint = '/api/sync/smart';
      } else if (syncType === 'shopify-to-notion') {
        endpoint = '/api/sync/shopify-to-notion';
      } else if (syncType === 'new-products') {
        endpoint = '/api/sync/new-products';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop }),
      });

      const data = await response.json();

      if (data.success) {
        addLog(`✅ Sync completed successfully`);
        addLog(`📊 Results: ${data.results.created || data.results.synced} created/synced, ${data.results.errors?.length || 0} errors`);
      } else {
        addLog(`❌ Sync failed: ${data.error}`);
      }

      setSyncResults(data.results);
    } catch (error) {
      addLog(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addLog = (message) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🛍️ Shopify-Notion Sync Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your product sync between Shopify and Notion
          </p>
        </div>

        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Shopify Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Shopify</h2>
              <div className={`w-4 h-4 rounded-full ${connectionStatus.shopify ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            {connectionStatus.shopify ? (
              <div>
                <p className="text-green-600 font-medium mb-3">✅ Connected</p>
                <p className="text-sm text-gray-600 mb-4">{shop}</p>
                <button
                  onClick={() => setShop('')}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-red-600 font-medium mb-3">❌ Not Connected</p>
                <button
                  onClick={startShopifyAuth}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Connect Store
                </button>
              </div>
            )}
          </div>

          {/* Notion Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Notion</h2>
              <div className={`w-4 h-4 rounded-full ${connectionStatus.notion ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            {connectionStatus.notion ? (
              <div>
                <p className="text-green-600 font-medium">✅ Connected</p>
                <p className="text-sm text-gray-600 mt-2">Database is accessible</p>
              </div>
            ) : (
              <div>
                <p className="text-red-600 font-medium">❌ Not Connected</p>
                <p className="text-sm text-gray-600 mt-2">Check your API key</p>
              </div>
            )}
          </div>
        </div>

        {/* Sync Controls */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Sync Options</h2>

          <div className="grid grid-cols-1 gap-4">
            {/* Smart Sync */}
            <button
              onClick={() => runSync('smart')}
              disabled={loading || !connectionStatus.shopify}
              className="p-6 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Smart Sync</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Detects and syncs only changed products (recommended)
                  </p>
                </div>
                {loading ? (
                  <div className="animate-spin text-blue-500">↻</div>
                ) : (
                  <div className="text-2xl">→</div>
                )}
              </div>
            </button>

                    {/* New Products Sync */}
        <button
          onClick={() => runSync('new-products')}
          disabled={loading || !connectionStatus.shopify}
          className="p-6 border-2 border-green-300 rounded-lg hover:bg-green-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Create New Products</h3>
              <p className="text-sm text-gray-600 mt-1">
                Create new products from Notion (with descriptions)
              </p>
            </div>
            {loading ? (
              <div className="animate-spin text-green-500">↻</div>
            ) : (
              <div className="text-2xl">→</div>
            )}
          </div>
        </button>

            {/* Full Sync */}
            <button
              onClick={() => runSync('shopify-to-notion')}
              disabled={loading || !connectionStatus.shopify}
              className="p-6 border-2 border-purple-300 rounded-lg hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Import from Shopify</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Import all products from Shopify to Notion
                  </p>
                </div>
                {loading ? (
                  <div className="animate-spin text-purple-500">↻</div>
                ) : (
                  <div className="text-2xl">→</div>
                )}
              </div>
            </button>
          </div>
        </div>



        {/* Results */}
        {syncResults && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sync Results</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-3xl font-bold text-blue-600">{syncResults.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Synced</p>
                <p className="text-3xl font-bold text-green-600">{syncResults.synced || syncResults.created || 0}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Errors</p>
                <p className="text-3xl font-bold text-yellow-600">{syncResults.errors?.length || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Sync Logs</h2>
            <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-gray-700 py-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}