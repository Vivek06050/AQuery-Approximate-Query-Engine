const { useState, useEffect, useRef, useCallback } = React;

let API_BASE_URL = 'http://localhost:3000';

const api = {
  exactQueries: {
    count: () => axios.get(`${API_BASE_URL}/count`),
    sum: (column) => axios.get(`${API_BASE_URL}/sum?column=${column}`),
    avg: (column) => axios.get(`${API_BASE_URL}/avg?column=${column}`),
    groupby: (group, agg) => axios.get(`${API_BASE_URL}/groupby?group=${group}&agg=${agg}`)
  },

  approximateQueries: {
    reservoir: {
      sum: (column) => axios.get(`${API_BASE_URL}/approx-sum?column=${column}`),
      avg: (column) => axios.get(`${API_BASE_URL}/approx-avg?column=${column}`),
      groupby: (group, agg) => axios.get(`${API_BASE_URL}/approx-groupby?group=${group}&agg=${agg}`)
    },
    block: {
      sum: (column) => axios.get(`${API_BASE_URL}/block-approx-sum?column=${column}`),
      avg: (column) => axios.get(`${API_BASE_URL}/block-approx-avg?column=${column}`),
      groupby: (group, agg) => axios.get(`${API_BASE_URL}/block-approx-groupby?group=${group}&agg=${agg}`)
    },
    stratified: {
      sum: (column) => axios.get(`${API_BASE_URL}/strat-approx-sum?column=${column}`),
      avg: (column) => axios.get(`${API_BASE_URL}/strat-approx-avg?column=${column}`),
      groupby: (group, agg) => axios.get(`${API_BASE_URL}/strat-approx-groupby?group=${group}&agg=${agg}`)
    },
    cms: {
      count: (item) => axios.get(`${API_BASE_URL}/cms/count?item=${item}`)
    }
  },

  statusQueries: {
    reservoir: () => axios.get(`${API_BASE_URL}/sampler/status`),
    block: () => axios.get(`${API_BASE_URL}/block-sampler/status`),
    stratified: () => axios.get(`${API_BASE_URL}/strat-sampler/status`),
    cms: () => axios.get(`${API_BASE_URL}/cms/status`)
  },

  actionQueries: {
    rebuild: (algorithm) => {
      const endpoints = {
        reservoir: '/sampler/rebuild',
        block: '/block-sampler/rebuild',
        stratified: '/strat-sampler/rebuild',
        cms: '/cms/rebuild'
      };
      return axios.post(`${API_BASE_URL}${endpoints[algorithm]}`);
    },
    ingest: (algorithm, data) => {
      const endpoints = {
        reservoir: '/sampler/ingest',
        block: '/block-sampler/ingest',
        stratified: '/strat-sampler/ingest',
        cms: '/cms/ingest'
      };
      return axios.post(`${API_BASE_URL}${endpoints[algorithm]}`, data, {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },

  updateBaseUrl: (newUrl) => {
    API_BASE_URL = newUrl;
  }
};

const usePolling = (callback, interval = 5000) => {
  const intervalRef = useRef();

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(callback, interval);
  }, [callback, interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { startPolling, stopPolling };
};

const Header = ({ backendStatus, onSettingsClick }) => {
  const getStatusColor = () => {
    switch (backendStatus) {
      case 'connected': return 'var(--color-teal-500)';
      case 'connecting': return 'var(--color-orange-400)';
      case 'disconnected': return 'var(--color-red-400)';
      default: return 'var(--color-gray-400)';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <h1 className="header-title">AQuery – Approximate Query Engine</h1>
          <div className="header-actions">
            <div className="status-indicator">
              <div 
                className="status-dot" 
                style={{ backgroundColor: getStatusColor() }}
              ></div>
              <span className="status-text">{getStatusText()}</span>
            </div>
            <button 
              className="btn btn--secondary"
              onClick={onSettingsClick}
            >
              Settings
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

const QueryBuilder = ({ onQueryExecute, isLoading }) => {
  const [queryType, setQueryType] = useState('COUNT');
  const [algorithm, setAlgorithm] = useState('reservoir');
  const [column, setColumn] = useState('salary');
  const [groupColumn, setGroupColumn] = useState('city');
  const [aggColumn, setAggColumn] = useState('salary');
  const [cmsItem, setCmsItem] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (algorithm === 'cms' && queryType === 'COUNT' && !cmsItem.trim()) {
      alert('Please enter an item for Count-Min Sketch');
      return;
    }

    const params = {
      queryType,
      algorithm,
      column,
      groupColumn,
      aggColumn,
      cmsItem
    };

    onQueryExecute(params);
  };

  const showColumnField = (queryType === 'SUM' || queryType === 'AVG') && algorithm !== 'cms';
  const showGroupFields = queryType === 'GROUP BY' && algorithm !== 'cms';
  const showCmsField = algorithm === 'cms' && queryType === 'COUNT';

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Query Builder</h2>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSubmit} className="query-form">
          <div className="form-group">
            <label className="form-label">Query Type</label>
            <select 
              className="form-control"
              value={queryType}
              onChange={(e) => setQueryType(e.target.value)}
            >
              <option value="COUNT">COUNT</option>
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="GROUP BY">GROUP BY</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Algorithm</label>
            <select 
              className="form-control"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
            >
              <option value="reservoir">Reservoir Sampling</option>
              <option value="block">Block Sampling</option>
              <option value="stratified">Stratified Sampling</option>
              <option value="cms">Count-Min Sketch</option>
            </select>
          </div>

          {showColumnField && (
            <div className="form-group">
              <label className="form-label">Column</label>
              <select 
                className="form-control"
                value={column}
                onChange={(e) => setColumn(e.target.value)}
              >
                <option value="salary">salary</option>
                <option value="age">age</option>
                <option value="id">id</option>
              </select>
            </div>
          )}

          {showGroupFields && (
            <>
              <div className="form-group">
                <label className="form-label">Group By Column</label>
                <select 
                  className="form-control"
                  value={groupColumn}
                  onChange={(e) => setGroupColumn(e.target.value)}
                >
                  <option value="city">city</option>
                  <option value="name">name</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Aggregation Column</label>
                <select 
                  className="form-control"
                  value={aggColumn}
                  onChange={(e) => setAggColumn(e.target.value)}
                >
                  <option value="salary">salary</option>
                  <option value="age">age</option>
                  <option value="id">id</option>
                </select>
              </div>
            </>
          )}

          {showCmsField && (
            <div className="form-group">
              <label className="form-label">Item to Count</label>
              <input 
                type="text"
                className="form-control"
                value={cmsItem}
                onChange={(e) => setCmsItem(e.target.value)}
                placeholder="Enter name (e.g., John)"
              />
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn--primary btn--full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Running Query...
              </>
            ) : (
              'Run Query'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

// Results Panel Component
const ResultsPanel = ({ exactResult, approxResult, queryHistory, chartRef }) => {
  const formatValue = (value, queryType) => {
    if (value === null || value === undefined) return 'N/A';
    
    if (queryType === 'GROUP BY') {
      if (Array.isArray(value)) {
        return `${value.length} groups`;
      } else if (typeof value === 'object') {
        return `${Object.keys(value).length} groups`;
      }
      return 'No groups';
    }
    
    if (typeof value === 'number') {
      return queryType === 'AVG' ? value.toFixed(2) : value.toLocaleString();
    }
    
    return value.toString();
  };

  const calculateError = (exactVal, approxVal) => {
    if (!exactVal || !approxVal || exactVal === 0) return null;
    return Math.abs((approxVal - exactVal) / exactVal * 100).toFixed(2);
  };

  const calculateSpeedImprovement = (exactTime, approxTime) => {
    if (!exactTime || !approxTime || exactTime <= 0 || approxTime <= 0) return null;
    return (exactTime / approxTime).toFixed(1);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Results & Visualization</h2>
      </div>
      <div className="panel-body">
        <div className="results-grid">
          <div className="result-card result-card--exact">
            <h3>Exact Result</h3>
            <div className="result-value">
              {exactResult ? formatValue(exactResult.value, exactResult.queryType) : 'N/A'}
            </div>
            <div className="result-meta">
              <span>Time: {exactResult?.time || 'N/A'}ms</span>
            </div>
          </div>

          <div className="result-card result-card--approx">
            <h3>Approximate Result</h3>
            <div className="result-value">
              {approxResult ? formatValue(approxResult.value, approxResult.queryType) : 'N/A'}
            </div>
            <div className="result-meta">
              <span>Time: {approxResult?.time || 'N/A'}ms</span>
              {approxResult && exactResult && calculateSpeedImprovement(exactResult.time, approxResult.time) && (
                <span className="speed-improvement">
                  {calculateSpeedImprovement(exactResult.time, approxResult.time)}x faster
                </span>
              )}
            </div>
            {approxResult && exactResult && calculateError(exactResult.value, approxResult.value) && (
              <div className="error-rate">
                Error: {calculateError(exactResult.value, approxResult.value)}%
              </div>
            )}
          </div>
        </div>

        <div className="chart-container">
          <canvas ref={chartRef} id="results-chart"></canvas>
        </div>

        <div className="query-history">
          <h3>Query History</h3>
          <div className="history-list">
            {queryHistory.length === 0 ? (
              <div className="history-placeholder">No queries executed yet</div>
            ) : (
              queryHistory.map((item, index) => (
                <div key={index} className="history-item">
                  <div className="history-query">{item.query}</div>
                  <div className="history-metrics">
                    <span>Exact: {item.exactTime}ms</span>
                    <span>Approx: {item.approxTime}ms</span>
                    <span>{item.speedup}x faster</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusPanel = ({ algorithmStatus, onRebuild, onIngestSample }) => {
  const algorithms = [
    { key: 'reservoir', name: 'Reservoir Sampling' },
    { key: 'block', name: 'Block Sampling' },
    { key: 'stratified', name: 'Stratified Sampling' },
    { key: 'cms', name: 'Count-Min Sketch' }
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Algorithm Status</h2>
      </div>
      <div className="panel-body">
        <div className="status-grid">
          {algorithms.map((algorithm) => {
            const status = algorithmStatus[algorithm.key] || {};
            const isReady = status.N > 0 || status.totalItems > 0 || status.totalRows > 0;
            
            return (
              <div key={algorithm.key} className="status-card">
                <div className="status-card-header">
                  <h4>{algorithm.name}</h4>
                  <div className={`status-indicator-mini ${isReady ? 'ready' : 'not-ready'}`}></div>
                </div>
                <div className="status-details">
                  <div className="status-item">
                    <span className="status-label">Status:</span>
                    <span className="status-value">{isReady ? 'Ready' : 'Not Ready'}</span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Sample Size:</span>
                    <span className="status-value">
                      {status.N || status.totalItems || status.totalRows || status.K || status.reservoirBlocks || 'N/A'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Last Updated:</span>
                    <span className="status-value">{status.lastUpdated || 'N/A'}</span>
                  </div>
                </div>
                <div className="status-actions">
                  <button 
                    className="btn btn--secondary btn--small"
                    onClick={() => onRebuild(algorithm.key)}
                  >
                    Rebuild
                  </button>
                  <button 
                    className="btn btn--secondary btn--small"
                    onClick={() => onIngestSample(algorithm.key)}
                  >
                    Ingest Sample
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
const IngestionPanel = ({ 
  isIngesting, 
  ingestionRate, 
  rowsIngested, 
  ingestionDuration,
  onToggleIngestion,
  onRateChange 
}) => {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Live Data Ingestion</h2>
      </div>
      <div className="panel-body">
        <div className="ingestion-controls">
          <div className="form-group">
            <label className="form-label">
              Ingestion Rate: {ingestionRate} rows/second
            </label>
            <input 
              type="range"
              min="1"
              max="10"
              value={ingestionRate}
              onChange={(e) => onRateChange(parseInt(e.target.value))}
              className="range-slider"
            />
          </div>

          <button 
            className={`btn ${isIngesting ? 'btn--primary' : 'btn--secondary'} btn--full`}
            onClick={onToggleIngestion}
          >
            <div className={`ingestion-indicator ${isIngesting ? 'active' : ''}`}></div>
            {isIngesting ? 'Stop Ingestion' : 'Start Ingestion'}
          </button>
        </div>

        <div className="ingestion-stats">
          <div className="stat-item">
            <span className="stat-label">Rows Ingested:</span>
            <span className="stat-value">{rowsIngested}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration:</span>
            <span className="stat-value">{ingestionDuration}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
const SettingsModal = ({ isOpen, onClose, backendUrl, onBackendUrlChange }) => {
  const [tempUrl, setTempUrl] = useState(backendUrl);

  useEffect(() => {
    setTempUrl(backendUrl);
  }, [backendUrl]);

  const handleSave = () => {
    onBackendUrlChange(tempUrl);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings & Documentation</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Backend URL</label>
            <input 
              type="text"
              className="form-control"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="http://localhost:3000"
            />
          </div>

          <div className="algorithm-docs">
            <h3>Algorithm Documentation</h3>
            
            <div className="doc-section">
              <h4>Reservoir Sampling</h4>
              <p>Maintains a random sample of fixed size from streaming data. High accuracy with fast performance.</p>
            </div>

            <div className="doc-section">
              <h4>Block Sampling</h4>
              <p>Samples contiguous blocks for better cache locality. Very fast speed with medium accuracy.</p>
            </div>

            <div className="doc-section">
              <h4>Stratified Sampling</h4>
              <p>Maintains proportional samples across data strata. Very high accuracy with medium speed.</p>
            </div>

            <div className="doc-section">
              <h4>Count-Min Sketch</h4>
              <p>Probabilistic data structure for frequency counting. Extremely fast with good accuracy.</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
};
const AQueryDashboard = () => {
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(false);
  const [exactResult, setExactResult] = useState(null);
  const [approxResult, setApproxResult] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [algorithmStatus, setAlgorithmStatus] = useState({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestionRate, setIngestionRate] = useState(2);
  const [rowsIngested, setRowsIngested] = useState(0);
  const [ingestionDuration, setIngestionDuration] = useState(0);
  const [ingestionStartTime, setIngestionStartTime] = useState(null);
  

  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const ingestionInterval = useRef(null);

  const extractValue = (result, queryType, isApproximate = false) => {
    console.log('API Response:', result); 
    
    if (!result) return null;
    
    if (queryType === 'COUNT') {
      if (isApproximate) {
        return result.approx_count || result.N || result.totalRows || result.totalItems || 0;
      } else {
        return result.result?.total_rows || 0;
      }
    } else if (queryType === 'SUM') {
      if (isApproximate) {
        return result.approx_sum || 0;
      } else {
        return result.result?.total_sum || 0;
      }
    } else if (queryType === 'AVG') {
      if (isApproximate) {
        return result.approx_avg || 0;
      } else {
        return result.result?.avg_value || 0;
      }
    } else if (queryType === 'GROUP BY') {
      if (isApproximate) {
        return result.approx_groupby || {};
      } else {
        const groups = result.result || [];
        const groupObj = {};
        groups.forEach(row => {
          const key = Object.keys(row)[0];
          const value = row.total || row[Object.keys(row)[1]];
          groupObj[row[key]] = value;
        });
        return groupObj;
      }
    }
    
    return 0;
  };
  const checkBackendStatus = useCallback(async () => {
    try {
      setBackendStatus('connecting');
      const response = await api.exactQueries.count();
      console.log('Backend connection test response:', response.data);
      setBackendStatus('connected');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setBackendStatus('disconnected');
    }
  }, []);
  const executeQuery = async (params) => {
    setIsLoading(true);
    setExactResult(null);
    setApproxResult(null);

    try {
      let exactPromise, approxPromise;

      switch (params.queryType) {
        case 'COUNT':
          exactPromise = api.exactQueries.count();
          break;
        case 'SUM':
          exactPromise = api.exactQueries.sum(params.column);
          break;
        case 'AVG':
          exactPromise = api.exactQueries.avg(params.column);
          break;
        case 'GROUP BY':
          exactPromise = api.exactQueries.groupby(params.groupColumn, params.aggColumn);
          break;
        default:
          throw new Error('Unknown query type');
      }

      if (params.queryType === 'COUNT') {
        if (params.algorithm === 'cms') {
          approxPromise = api.approximateQueries.cms.count(params.cmsItem);
        } else {
          approxPromise = api.statusQueries[params.algorithm]().then(response => {
            const data = response.data;
            const approxCount = data.N || data.totalRows || data.totalItems || 0;
            return {
              data: {
                N: approxCount,
                time_ms: data.time_ms || 1
              }
            };
          });
        }
      } else {
        switch (params.queryType) {
          case 'SUM':
            approxPromise = api.approximateQueries[params.algorithm].sum(params.column);
            break;
          case 'AVG':
            approxPromise = api.approximateQueries[params.algorithm].avg(params.column);
            break;
          case 'GROUP BY':
            approxPromise = api.approximateQueries[params.algorithm].groupby(params.groupColumn, params.aggColumn);
            break;
        }
      }

      const [exactResponse, approxResponse] = await Promise.all([exactPromise, approxPromise]);

      console.log('Exact response:', exactResponse.data);
      console.log('Approx response:', approxResponse.data);

      const exactData = {
        value: extractValue(exactResponse.data, params.queryType, false),
        time: exactResponse.data.time_ms || 0,
        queryType: params.queryType
      };

      const approxData = {
        value: extractValue(approxResponse.data, params.queryType, true),
        time: approxResponse.data.time_ms || 0,
        queryType: params.queryType
      };

      console.log('Extracted exact data:', exactData);
      console.log('Extracted approx data:', approxData);

      setExactResult(exactData);
      setApproxResult(approxData);

      const historyItem = {
        query: `${params.queryType} (${params.algorithm})`,
        exactTime: exactData.time,
        approxTime: approxData.time,
        speedup: exactData.time > 0 && approxData.time > 0 ? (exactData.time / approxData.time).toFixed(1) : 'N/A',
        timestamp: new Date().toLocaleTimeString()
      };

      setQueryHistory(prev => [historyItem, ...prev.slice(0, 4)]);
      if (params.queryType === 'GROUP BY' && typeof exactData.value === 'object' && typeof approxData.value === 'object') {
        updateChart(exactData.value, approxData.value);
      }

    } catch (error) {
      console.error('Query execution failed:', error);
      alert('Query execution failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };
  const updateChart = (exactData, approxData) => {
    if (!chartInstance.current) return;

    const labels = Object.keys(exactData);
    const exactValues = labels.map(label => exactData[label] || 0);
    const approxValues = labels.map(label => approxData[label] || 0);

    chartInstance.current.data.labels = labels;
    chartInstance.current.data.datasets[0].data = exactValues;
    chartInstance.current.data.datasets[1].data = approxValues;
    chartInstance.current.update();
  };
  const initChart = () => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Exact',
            data: [],
            backgroundColor: '#1FB8CD',
            borderColor: '#1FB8CD',
            borderWidth: 1
          },
          {
            label: 'Approximate',
            data: [],
            backgroundColor: '#FFC185',
            borderColor: '#FFC185',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          title: {
            display: true,
            text: 'Exact vs Approximate Results'
          }
        }
      }
    });
  };
  const updateAlgorithmStatus = async () => {
    const algorithms = ['reservoir', 'block', 'stratified', 'cms'];
    const newStatus = {};

    for (const algorithm of algorithms) {
      try {
        const response = await api.statusQueries[algorithm]();
        newStatus[algorithm] = {
          ...response.data,
          lastUpdated: new Date().toLocaleTimeString()
        };
      } catch (error) {
        newStatus[algorithm] = {
          ready: false,
          lastUpdated: 'Error'
        };
      }
    }

    setAlgorithmStatus(newStatus);
  };
  const handleRebuild = async (algorithm) => {
    try {
      await api.actionQueries.rebuild(algorithm);
      await updateAlgorithmStatus();
    } catch (error) {
      console.error(`Failed to rebuild ${algorithm}:`, error);
    }
  };
  const handleIngestSample = async (algorithm) => {
    try {
      const sampleData = algorithm === 'cms' ? 'John' : '1,John,25,Delhi,40000';
      await api.actionQueries.ingest(algorithm, sampleData);
      await updateAlgorithmStatus();
    } catch (error) {
      console.error(`Failed to ingest sample to ${algorithm}:`, error);
    }
  };
  const generateSampleRow = () => {
    const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata'];
    const names = ['John', 'Alice', 'Bob', 'Diana', 'Charlie'];
    
    const id = Math.floor(Math.random() * 10000);
    const name = names[Math.floor(Math.random() * names.length)];
    const age = Math.floor(Math.random() * 40) + 25;
    const city = cities[Math.floor(Math.random() * cities.length)];
    const salary = Math.floor(Math.random() * 100000) + 30000;
    
    return `${id},${name},${age},${city},${salary}`;
  };
  const startIngestion = () => {
    setIsIngesting(true);
    setIngestionStartTime(Date.now());
    setRowsIngested(0);

    const interval = 1000 / ingestionRate;
    
    ingestionInterval.current = setInterval(async () => {
      const sampleRow = generateSampleRow();
      const algorithms = ['reservoir', 'block', 'stratified'];
      for (const algorithm of algorithms) {
        try {
          await api.actionQueries.ingest(algorithm, sampleRow);
        } catch (error) {
          console.error(`Failed to ingest to ${algorithm}:`, error);
        }
      }
      try {
        const name = sampleRow.split(',')[1];
        await api.actionQueries.ingest('cms', name);
      } catch (error) {
        console.error('Failed to ingest to CMS:', error);
      }
      
      setRowsIngested(prev => prev + 1);
    }, interval);
  };
  const stopIngestion = () => {
    setIsIngesting(false);
    if (ingestionInterval.current) {
      clearInterval(ingestionInterval.current);
      ingestionInterval.current = null;
    }
  };
  const toggleIngestion = () => {
    if (isIngesting) {
      stopIngestion();
    } else {
      startIngestion();
    }
  };
  useEffect(() => {
    let durationInterval;
    
    if (isIngesting && ingestionStartTime) {
      durationInterval = setInterval(() => {
        setIngestionDuration(Math.floor((Date.now() - ingestionStartTime) / 1000));
      }, 1000);
    }

    return () => {
      if (durationInterval) {
        clearInterval(durationInterval);
      }
    };
  }, [isIngesting, ingestionStartTime]);
  const handleBackendUrlChange = (newUrl) => {
    setBackendUrl(newUrl);
    api.updateBaseUrl(newUrl);
    checkBackendStatus();
  };
  const { startPolling, stopPolling } = usePolling(updateAlgorithmStatus, 5000);
  useEffect(() => {
    checkBackendStatus();
    updateAlgorithmStatus();
    initChart();
    startPolling();

    return () => {
      stopPolling();
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      if (ingestionInterval.current) {
        clearInterval(ingestionInterval.current);
      }
    };
  }, []);

  return (
    <div className="app">
      <Header 
        backendStatus={backendStatus}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      
      <main className="main-content">
        <div className="container">
          <div className="dashboard-grid">
            <QueryBuilder 
              onQueryExecute={executeQuery}
              isLoading={isLoading}
            />
            
            <ResultsPanel 
              exactResult={exactResult}
              approxResult={approxResult}
              queryHistory={queryHistory}
              chartRef={chartRef}
            />
            
            <StatusPanel 
              algorithmStatus={algorithmStatus}
              onRebuild={handleRebuild}
              onIngestSample={handleIngestSample}
            />
            
            <IngestionPanel 
              isIngesting={isIngesting}
              ingestionRate={ingestionRate}
              rowsIngested={rowsIngested}
              ingestionDuration={ingestionDuration}
              onToggleIngestion={toggleIngestion}
              onRateChange={setIngestionRate}
            />
          </div>
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        backendUrl={backendUrl}
        onBackendUrlChange={handleBackendUrlChange}
      />
    </div>
  );
};
ReactDOM.render(<AQueryDashboard />, document.getElementById('root'));
