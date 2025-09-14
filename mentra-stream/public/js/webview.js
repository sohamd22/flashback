(function() {
    let isStreaming = false;
    let currentStreamStatus = '';
    const logs = [];
    const MAX_LOGS = 100;

    const elements = {
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText'),
        streamToggle: document.getElementById('streamToggle'),
        rtmpUrl: document.getElementById('rtmpUrl'),
        livePlayer: document.getElementById('livePlayer'),
        statusLogs: document.getElementById('statusLogs'),
        logsContent: document.getElementById('logsContent'),
        videoOverlay: document.getElementById('videoOverlay'),
        overlayMessage: document.getElementById('overlayMessage'),
        playIcon: document.querySelector('.play-icon'),
        stopIcon: document.querySelector('.stop-icon'),
        batteryIndicator: document.getElementById('batteryIndicator'),
        batteryPercent: document.querySelector('.battery-percent'),
        batteryFill: document.querySelector('.battery-fill')
    };

    function initializeFromData() {
        const hasActiveSession = document.getElementById('hasActiveSession')?.textContent === 'true';
        const initialStreamType = document.getElementById('initialStreamType')?.textContent;
        const initialStreamStatus = document.getElementById('initialStreamStatus')?.textContent;
        const initialError = document.getElementById('initialError')?.textContent;
        
        // Load saved configuration
        const savedCustomRtmpUrl = document.getElementById('savedCustomRtmpUrl')?.textContent || '';
        
        // Restore saved values
        elements.rtmpUrl.value = savedCustomRtmpUrl;

        if (initialStreamStatus) {
            updateStatus(initialStreamStatus, initialStreamType);
            currentStreamStatus = initialStreamStatus;
            
            // Determine button state based on actual status
            const shouldShowStop = isStreamingStatus(initialStreamStatus);
            isStreaming = shouldShowStop;
            updateStreamButton(shouldShowStop);
            
            if (shouldShowStop) {
                updateDisplay('logs');
                addLog('info', 'Stream active: ' + initialStreamStatus);
            }
            
            // Disable controls if streaming
            updateControlsState(shouldShowStop);
        }

        if (initialError) {
            console.error('Initial error:', initialError);
            addLog('error', initialError);
        }
    }
    
    function isStreamingStatus(status) {
        const statusLower = (status || '').toLowerCase();
        return statusLower === 'active' || 
               statusLower === 'streaming' || 
               statusLower === 'connected' ||
               statusLower === 'connecting' ||
               statusLower === 'starting' ||
               statusLower === 'pending' ||
               statusLower === 'stopping' ||
               statusLower === 'disconnecting' ||
               statusLower === 'initializing';
    }

    function updateStatus(status, type) {
        currentStreamStatus = status || '';
        
        const statusLower = status?.toLowerCase() || '';
        
        // Determine visual state based on actual status
        let statusClass = '';
        let displayText = 'Offline';
        
        if (statusLower === 'active' || statusLower === 'streaming' || statusLower === 'connected') {
            statusClass = 'online';
            displayText = 'Live';
        } else if (statusLower === 'connecting' || statusLower === 'starting' || statusLower === 'pending') {
            statusClass = 'connecting';
            displayText = 'Connecting';
        } else if (statusLower === 'stopping' || statusLower === 'disconnecting') {
            statusClass = 'connecting';
            displayText = 'Stopping';
        } else if (statusLower === 'error' || statusLower === 'failed') {
            statusClass = '';
            displayText = 'Error';
        } else if (statusLower === 'idle' || statusLower === 'ready') {
            statusClass = '';
            displayText = 'Ready';
        } else if (status) {
            // Show the actual status if we don't recognize it
            displayText = status;
        }

        elements.statusIndicator.className = 'status-indicator' + (statusClass ? ' ' + statusClass : '');
        elements.statusText.textContent = displayText;
    }

    function updateStreamButton(streaming) {
        if (streaming) {
            elements.streamToggle.classList.add('streaming');
            elements.playIcon.style.display = 'none';
            elements.stopIcon.style.display = 'block';
        } else {
            elements.streamToggle.classList.remove('streaming');
            elements.playIcon.style.display = 'block';
            elements.stopIcon.style.display = 'none';
        }
    }

    function getRtmpUrl() {
        return elements.rtmpUrl.value.trim();
    }

    function updateDisplay(mode) {
        if (mode === 'logs') {
            // Show logs for RTMP streams
            elements.livePlayer.src = '';
            elements.livePlayer.classList.remove('visible');
            elements.statusLogs.classList.add('visible');
            elements.videoOverlay.classList.add('hidden');
        } else {
            // Show overlay when nothing is active
            elements.livePlayer.src = '';
            elements.livePlayer.classList.remove('visible');
            elements.statusLogs.classList.remove('visible');
            elements.videoOverlay.classList.remove('hidden');
        }
    }

    function addLog(type, message) {
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        logs.push({ timestamp, type, message });
        
        // Keep only the last MAX_LOGS entries
        if (logs.length > MAX_LOGS) {
            logs.shift();
        }
        
        // Update display if logs are visible
        if (elements.statusLogs.classList.contains('visible')) {
            renderLogs();
        }
    }
    
    function renderLogs() {
        const html = logs.map(log => `
            <div class="log-entry ${log.type}">
                <span class="log-timestamp">${log.timestamp}</span>
                <span class="log-message">${log.message}</span>
            </div>
        `).join('');
        
        elements.logsContent.innerHTML = html;
        // Auto-scroll to bottom
        elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
    }

    async function postJson(url, body) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
            return await response.json().catch(() => ({ ok: response.ok }));
        } catch (error) {
            console.error('API error:', error);
            return { ok: false, error: error.message };
        }
    }

    async function checkExistingStream() {
        try {
            const response = await fetch('/api/stream/check');
            const result = await response.json();
            
            if (result.ok && result.hasActiveStream && result.streamInfo) {
                addLog('info', `Found existing stream`);
                
                const rtmpUrl = result.streamInfo.rtmpUrl || 'Unknown URL';
                const appId = result.streamInfo.requestingAppId || 'Unknown app';
                addLog('warning', `Another app (${appId}) is streaming to: ${rtmpUrl}`);
                
                return result;
            }
            
            return { ok: true, hasActiveStream: false };
        } catch (error) {
            console.error('Error checking existing stream:', error);
            return { ok: false, error: error.message };
        }
    }

    async function startStream() {
        // Don't start if already in a streaming state
        if (isStreamingStatus(currentStreamStatus)) return;

        // Check for existing streams first
        const checkResult = await checkExistingStream();
        if (checkResult.hasActiveStream) {
            // Stream is already active, SSE will handle the UI update
            addLog('info', 'Reconnecting to existing stream...');
            return;
        }

        const rtmpUrl = getRtmpUrl();
        if (!rtmpUrl) {
            alert('Please enter an RTMP URL');
            updateStatus('Offline');
            isStreaming = false;
            updateStreamButton(false);
            updateControlsState(false);  // Re-enable controls
            updateDisplay('none');
            addLog('error', 'No RTMP URL provided');
            return;
        }
        
        // Update UI optimistically
        updateStatus('Connecting');
        isStreaming = true;
        updateStreamButton(true);
        updateControlsState(true);  // Disable controls
        
        updateDisplay('logs');  // Show logs immediately
        addLog('info', '--- New stream session ---');
        addLog('info', 'Starting RTMP stream...');
        
        addLog('info', 'Connecting to: ' + rtmpUrl.replace(/\/[^\/]*$/, '/****'));  // Hide key in logs
        const result = await postJson('/api/stream/start', { rtmpUrl });
        if (result.ok === false) {
            // Revert on error
            updateStatus('Error');
            isStreaming = false;
            updateStreamButton(false);
            updateControlsState(false);  // Re-enable controls
            addLog('error', 'Failed to start: ' + (result.error || 'Unknown error'));
            alert('Failed to start stream: ' + (result.error || 'Unknown error'));
        } else {
            addLog('success', 'RTMP stream request sent');
        }
    }

    async function stopStream() {
        // Don't stop if not in a streaming state
        if (!isStreamingStatus(currentStreamStatus)) return;

        // Update UI optimistically
        updateStatus('Stopping');
        isStreaming = true;  // Keep button as "stop" while stopping
        updateStreamButton(true);
        
        addLog('info', 'Stopping stream...');
        
        await postJson('/api/stream/stop');
        // Let SSE update the actual status
    }
    
    function updateControlsState(disabled) {
        // Disable/enable RTMP URL input when streaming
        elements.rtmpUrl.disabled = disabled;
    }

    // Event listeners
    elements.streamToggle.addEventListener('click', () => {
        if (isStreaming) {
            stopStream();
        } else {
            startStream();
        }
    });

    // Server-sent events for real-time status updates
    try {
        const es = new EventSource('/stream-status');
        es.addEventListener('status', (evt) => {
            let data = {};
            try { 
                data = JSON.parse(evt.data); 
            } catch(e) {
                console.error('Failed to parse SSE data:', e);
            }

            // Update connection status
            if (data.hasActiveSession !== undefined) {
                const sessionActive = !!data.hasActiveSession;
                if (!sessionActive) {
                    // Session was lost - update everything
                    currentStreamStatus = 'offline';
                    updateStatus('Offline');
                    if (isStreaming) {
                        isStreaming = false;
                        updateStreamButton(false);
                        updateControlsState(false);  // Re-enable controls
                        addLog('error', 'Session lost');
                        // Keep logs visible if they exist
                        if (logs.length > 0) {
                            updateDisplay('logs');
                        } else {
                            updateDisplay('none');
                        }
                    }
                }
            }

            // Update stream status - always use the actual status from server
            if (data.streamStatus !== undefined) {
                const oldStatus = currentStreamStatus;
                updateStatus(data.streamStatus, data.streamType);
                
                // Log status changes
                if (oldStatus !== data.streamStatus) {
                    const statusLower = (data.streamStatus || '').toLowerCase();
                    let logType = 'info';
                    if (statusLower === 'active' || statusLower === 'connected' || statusLower === 'streaming') {
                        logType = 'success';
                    } else if (statusLower === 'error' || statusLower === 'failed') {
                        logType = 'error';
                    } else if (statusLower === 'stopping' || statusLower === 'disconnecting') {
                        logType = 'warning';
                    }
                    addLog(logType, 'Status: ' + data.streamStatus);
                }
                
                // Always update button state based on actual status
                const shouldShowStop = isStreamingStatus(data.streamStatus);
                
                if (shouldShowStop !== isStreaming) {
                    isStreaming = shouldShowStop;
                    updateStreamButton(shouldShowStop);
                    updateControlsState(shouldShowStop);  // Update controls state
                }
                
                // Update display based on status
                if (shouldShowStop) {
                    updateDisplay('logs');
                } else {
                    // Not streaming - keep logs visible if they exist
                    if (logs.length > 0) {
                        updateDisplay('logs');
                    } else {
                        updateDisplay('none');
                    }
                }
            }

            // Handle battery updates from glasses
            if (data.glassesBatteryPercent !== undefined) {
                updateBatteryDisplay(data.glassesBatteryPercent);
            }
            
            // Handle errors
            if (data.error) {
                console.error('Stream error:', data.error);
                addLog('error', data.error);
                if (data.error.toLowerCase().includes('failed') || 
                    data.error.toLowerCase().includes('error')) {
                    updateStatus('Error');
                }
            }
        });

        es.onerror = () => {
            console.log('SSE connection error, will retry...');
        };
    } catch (e) {
        console.error('SSE not supported:', e);
    }

    // Battery display update
    function updateBatteryDisplay(percent) {
        if (percent === null || percent === undefined) {
            // No battery data available
            elements.batteryPercent.textContent = '--';
            elements.batteryFill.setAttribute('width', '0');
            return;
        }
        
        // Update percentage text
        elements.batteryPercent.textContent = percent + '%';
        
        // Update battery fill width
        const fillWidth = Math.max(0, Math.min(16, (percent / 100) * 16));
        elements.batteryFill.setAttribute('width', fillWidth);
        
        // Update color based on level
        elements.batteryIndicator.classList.remove('low', 'medium');
        if (percent <= 20) {
            elements.batteryIndicator.classList.add('low');
        } else if (percent <= 50) {
            elements.batteryIndicator.classList.add('medium');
        }
    }

    // Initialize
    initializeFromData();
    updatePlatformConfig(currentPlatform);
    
    // Check for existing streams on page load
    setTimeout(async () => {
        const checkResult = await checkExistingStream();
        if (checkResult.hasActiveStream && checkResult.streamInfo) {
            addLog('info', 'Existing stream detected on page load');
        }
    }, 500);
})();