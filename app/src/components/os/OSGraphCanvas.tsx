'use client';

import { useState, useRef, useEffect } from 'react';
import { GraphData, GraphNode } from '@/types/graph';

interface OSGraphCanvasProps {
  data: GraphData;
  width: number;
  height: number;
  onUserClick?: () => void;
  onFriendClick?: (friendId: string) => void;
}

interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: { x: number; y: number };
  originalPosition: { x: number; y: number };
}

export default function OSGraphCanvas({ data, width, height, onUserClick, onFriendClick }: OSGraphCanvasProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 },
    originalPosition: { x: 0, y: 0 }
  });
  const animationRef = useRef<number>(0);

  // Position nodes in a circle around the center (similar to RealVideoGraphCanvas)
  useEffect(() => {
    console.log('OSGraphCanvas received data:', data);
    console.log('Data nodes:', data.nodes);
    console.log('Data connections:', data.connections);
    
    if (!data.nodes.length) return;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    // Find the current user node
    const currentUser = data.nodes.find(n => n.isUser);
    const otherNodes = data.nodes.filter(n => !n.isUser);
    
    // First pass: position first-degree connections (your direct friends) around you
    const firstDegreeNodes = new Map<string, { node: GraphNode; connection: any }>();
    const secondDegreeNodes: GraphNode[] = [];
    
    otherNodes.forEach(node => {
      const directConnection = data.connections.find(c => 
        (c.fromId === currentUser?.id && c.toId === node.id) ||
        (c.fromId === node.id && c.toId === currentUser?.id)
      );
      
      if (directConnection) {
        firstDegreeNodes.set(node.id, { node, connection: directConnection });
      } else {
        secondDegreeNodes.push(node);
      }
    });
    
    // First, position the user and first-degree connections
    const positionedNodesMap = new Map();
    
    // Position user in center
    if (currentUser) {
      positionedNodesMap.set(currentUser.id, { ...currentUser, x: centerX, y: centerY });
    }
    
    // Position first-degree connections (your friends) around you
    Array.from(firstDegreeNodes.entries()).forEach(([nodeId, { node, connection }]) => {
      const interactionCount = connection.interactions || 0;
      const maxInteractions = Math.max(...data.connections.map(c => c.interactions || 0), 1);
      
      // Distance based on interaction strength with minimum distance to prevent overlap
      const minDistance = Math.max(radius * 0.4, 200); // At least 100px from center, even with highest interactions
      const maxDistance = radius * 1.0;
      const normalizedInteractions = interactionCount / maxInteractions;
      const distance = Math.max(minDistance, maxDistance - (normalizedInteractions * (maxDistance - minDistance)));
      
      // Random angle for natural scatter
      const nodeIndex = Array.from(firstDegreeNodes.keys()).indexOf(nodeId);
      const seedAngle = (nodeIndex * 137.5) % 360;
      const randomAngleOffset = (Math.sin(nodeIndex * 2.3) * 30);
      const angle = (seedAngle + randomAngleOffset) * (Math.PI / 180);
      
      positionedNodesMap.set(nodeId, {
        ...node,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance
      });
    });
    
    // Now position second-degree connections relative to first-degree connections
    secondDegreeNodes.forEach(node => {
      // Find connections to positioned nodes
      const nodeConnections = data.connections.filter(c => 
        c.fromId === node.id || c.toId === node.id
      );
      
      // Find which of your friends this person is connected to
      const friendConnections = nodeConnections.filter(c => {
        const connectedToId = c.fromId === node.id ? c.toId : c.fromId;
        return firstDegreeNodes.has(connectedToId);
      });
      
      if (friendConnections.length === 0) {
        // No connections to your friends - place far away randomly with minimum distance
        const nodeIndex = secondDegreeNodes.findIndex(n => n.id === node.id);
        const angle = (nodeIndex * 137.5) * (Math.PI / 180);
        const distance = Math.max(radius * 1.4, 250); // At least 250px from center
        
        positionedNodesMap.set(node.id, {
          ...node,
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance
        });
        return;
      }
      
      // Position near their strongest connection among your friends
      const strongestConnection = friendConnections.reduce((max, current) => 
        (current.interactions || 0) > (max.interactions || 0) ? current : max
      );
      
      const connectedFriendId = strongestConnection.fromId === node.id ? 
        strongestConnection.toId : strongestConnection.fromId;
      
      // Find the positioned friend node
      const friendNode = positionedNodesMap.get(connectedFriendId);
      
      if (!friendNode) {
        // Fallback positioning with minimum distance
        const nodeIndex = secondDegreeNodes.findIndex(n => n.id === node.id);
        const angle = (nodeIndex * 137.5) * (Math.PI / 180);
        const distance = Math.max(radius * 1.2, 220); // At least 220px from center
        
        positionedNodesMap.set(node.id, {
          ...node,
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance
        });
        return;
      }
      
      // Position this node in a cluster around the friend based on interaction strength
      const nodeIndex = secondDegreeNodes.findIndex(n => n.id === node.id);
      const interactionStrength = (strongestConnection.interactions || 1) / Math.max(...data.connections.map(c => c.interactions || 0), 1);
      
      // Base cluster distance on interaction strength, but with minimum distance for all connections
      const baseClusterDistance = 120; // Minimum distance from any friend
      const maxClusterDistance = 180;   // Maximum distance for weak connections
      const clusterDistance = Math.max(baseClusterDistance, 
        maxClusterDistance - (interactionStrength * (maxClusterDistance - baseClusterDistance))
      );
      
      // Spread nodes around the friend with better spacing
      const clusterAngle = (nodeIndex * 72 + Math.sin(nodeIndex * 1.7) * 30) * (Math.PI / 180); // 72° spacing (5 positions max per friend)
      
      // Calculate position relative to friend, but away from center
      const friendToCenterAngle = Math.atan2(friendNode.y - centerY, friendNode.x - centerX);
      const finalAngle = friendToCenterAngle + clusterAngle;
      
      positionedNodesMap.set(node.id, {
        ...node,
        x: friendNode.x + Math.cos(finalAngle) * clusterDistance,
        y: friendNode.y + Math.sin(finalAngle) * clusterDistance
      });
    });
    
    // Convert map back to array in original order
    const positionedNodes = data.nodes.map(node => positionedNodesMap.get(node.id) || node);
    
    console.log('Positioned nodes:', positionedNodes);
    setNodes(positionedNodes);
  }, [data, width, height]);

  // Apply styling based on interactions with current user
  const getNodeStyle = (node: GraphNode) => {
    if (node.isUser) return { cursor: 'pointer' };
    
    const currentUserId = data.nodes.find(n => n.isUser)?.id;
    if (!currentUserId) return { cursor: 'not-allowed', filter: 'grayscale(0.8)' };
    
    const connection = data.connections.find(c => 
      (c.fromId === currentUserId && c.toId === node.id) ||
      (c.fromId === node.id && c.toId === currentUserId)
    );
    
    if (!connection) {
      return { 
        cursor: 'not-allowed', 
        filter: 'grayscale(0.9) opacity(0.6)',
        pointerEvents: 'auto' // Still allow clicking to show error message
      };
    }
    
    // Find max interactions for normalization
    const maxInteractions = Math.max(...data.connections.map(c => c.interactions || 0), 1);
    const normalizedInteractions = (connection.interactions || 0) / maxInteractions;
    
    // Grayscale inversely proportional to interactions (0-0.6)
    const grayscale = 0.6 - (normalizedInteractions * 0.4);
    
    return {
      cursor: 'pointer',
      filter: `grayscale(${grayscale})`,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.nodeId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragState.offset.x;
    const newY = e.clientY - rect.top - dragState.offset.y;

    const nodeSize = 60;
    const constrainedX = Math.max(nodeSize/2, Math.min(width - nodeSize/2, newX));
    const constrainedY = Math.max(nodeSize/2, Math.min(height - nodeSize/2, newY));

    setNodes(prevNodes =>
      prevNodes.map(node =>
        node.id === dragState.nodeId ? { ...node, x: constrainedX, y: constrainedY } : node
      )
    );
  };

  const handleMouseUp = () => {
    if (!dragState.isDragging || !dragState.nodeId) return;

    const currentNode = nodes.find(n => n.id === dragState.nodeId);
    if (currentNode) {
      // Animate back to the stored original position from when dragging started
      // This ensures we return to the correct algorithm-calculated position
      animateNodeBack(dragState.nodeId, { x: currentNode.x, y: currentNode.y }, dragState.originalPosition);
    }

    setDragState({
      isDragging: false,
      nodeId: null,
      offset: { x: 0, y: 0 },
      originalPosition: { x: 0, y: 0 }
    });
  };

  const animateNodeBack = (nodeId: string, currentPos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
    const startTime = performance.now();
    const duration = 600;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutElastic = (t: number) => {
        const c4 = (2 * Math.PI) / 4.5;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1;
      };

      const easedProgress = easeOutElastic(progress);
      const newX = currentPos.x + (targetPos.x - currentPos.x) * easedProgress;
      const newY = currentPos.y + (targetPos.y - currentPos.y) * easedProgress;

      setNodes(prevNodes =>
        prevNodes.map(node =>
          node.id === nodeId ? { ...node, x: newX, y: newY } : node
        )
      );

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  };



  return (
    <div 
      className="relative"
      style={{ width, height, imageRendering: 'pixelated' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Pixelated sky background with sun and clouds */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #87ceeb 0%, #e0f6ff 40%, #ffffff 100%)',
          zIndex: 0
        }}
      />
      
      {/* Pixelated sun */}
      <div 
        className="absolute"
        style={{
          top: '120px',
          right: '60px',
          width: '60px',
          height: '60px',
          background: `
            radial-gradient(4px 4px at 8px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 16px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 24px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 32px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 40px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 8px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 16px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 16px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 24px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 24px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 32px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 32px, #ffd700, transparent),
            radial-gradient(4px 4px at 8px 40px, #ffd700, transparent),
            radial-gradient(4px 4px at 48px 40px, #ffd700, transparent),
            radial-gradient(4px 4px at 16px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 24px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 32px 48px, #ffd700, transparent),
            radial-gradient(4px 4px at 40px 48px, #ffd700, transparent),
            radial-gradient(8px 8px at 16px 16px, #ffed4e, transparent),
            radial-gradient(8px 8px at 32px 16px, #ffed4e, transparent),
            radial-gradient(8px 8px at 16px 32px, #ffed4e, transparent),
            radial-gradient(8px 8px at 32px 32px, #ffed4e, transparent),
            #ffd700
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'sunGlow 3s ease-in-out infinite alternate',
          zIndex: 1
        }}
      />
      
      {/* Pixelated clouds */}
      <div 
        className="absolute"
        style={{
          top: '100px',
          left: '100px',
          width: '80px',
          height: '40px',
          background: `
            radial-gradient(4px 4px at 16px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 24px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 32px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 40px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 48px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 56px 16px, #ffffff, transparent),
            radial-gradient(4px 4px at 12px 24px, #ffffff, transparent),
            radial-gradient(4px 4px at 60px 24px, #ffffff, transparent),
            radial-gradient(4px 4px at 8px 32px, #ffffff, transparent),
            radial-gradient(4px 4px at 64px 32px, #ffffff, transparent),
            radial-gradient(6px 6px at 20px 20px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 36px 20px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 52px 20px, #f8f9fa, transparent),
            rgba(255, 255, 255, 0.9)
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'cloudFloat 20s ease-in-out infinite',
          zIndex: 1
        }}
      />
      
      <div 
        className="absolute"
        style={{
          top: '140px',
          right: '300px',
          width: '60px',
          height: '30px',
          background: `
            radial-gradient(4px 4px at 12px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 20px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 28px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 36px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 44px 12px, #ffffff, transparent),
            radial-gradient(4px 4px at 8px 20px, #ffffff, transparent),
            radial-gradient(4px 4px at 48px 20px, #ffffff, transparent),
            radial-gradient(6px 6px at 18px 16px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 30px 16px, #f8f9fa, transparent),
            radial-gradient(6px 6px at 42px 16px, #f8f9fa, transparent),
            rgba(255, 255, 255, 0.8)
          `,
          backgroundSize: '4px 4px',
          imageRendering: 'pixelated',
          animation: 'cloudFloat 25s ease-in-out infinite reverse',
          zIndex: 1
        }}
      />
      
      <style jsx>{`
        @keyframes sunGlow {
          0% { filter: brightness(1) drop-shadow(0 0 10px #ffd700); }
          100% { filter: brightness(1.1) drop-shadow(0 0 20px #ffd700); }
        }
        
        @keyframes cloudFloat {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(30px); }
        }
      `}</style>

      
      {/* All nodes including user with dynamic positioning */}
      {nodes.map((node) => {
        const isDragging = dragState.nodeId === node.id;
        const isHovered = hoveredNode === node.id;
        const nodeStyle = getNodeStyle(node);
        const isUser = node.isUser;
        
        return (
          <div
            key={node.id}
            className={`absolute ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
              left: node.x - (isUser ? 40 : 32), // Half of node width (user: 80px, others: 64px)
              top: node.y - (isUser ? 40 : 32),  // Half of node height
              zIndex: isUser ? 15 : (isDragging ? 20 : 5),
              transform: isDragging ? 'scale(1.1)' : 'scale(1)',
              ...nodeStyle
            }}
            onClick={(e) => {
              e.stopPropagation();
              setTimeout(() => {
                if (!dragState.isDragging) {
                  if (isUser && onUserClick) {
                    onUserClick();
                  } else if (!isUser && onFriendClick) {
                    onFriendClick(node.id);
                  }
                }
              }, 50);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
              
              if (!containerRect) return;

              setDragState({
                isDragging: true,
                nodeId: node.id,
                offset: {
                  x: e.clientX - containerRect.left - node.x,
                  y: e.clientY - containerRect.top - node.y
                },
                originalPosition: { x: node.x, y: node.y }
              });

              if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
              }
            }}
            onMouseEnter={() => !dragState.isDragging && setHoveredNode(node.id)}
            onMouseLeave={() => !dragState.isDragging && setHoveredNode(null)}
          >
            {/* Node visual */}
            <div className="relative">
              <div 
                className={`${
                  isUser ? 'w-20 h-20 border-4 border-gray-600 bg-white' : 'w-16 h-16 border-4 border-green-600'
                } flex items-center justify-center hover:scale-105 transition-transform overflow-hidden`}
                style={{
                  imageRendering: 'pixelated',
                  boxShadow: isUser 
                    ? 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,1), 6px 6px 0px rgba(0,0,0,0.2)'
                    : 'inset -3px -3px 0px rgba(0,0,0,0.3), inset 3px 3px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.2)',
                  background: isUser 
                    ? 'linear-gradient(135deg, #f8fafc, #e2e8f0)'
                    : 'linear-gradient(135deg, #dcfce7, #22c55e)'
                }}
              >
                <img 
                  src={node.photo || '/icons/user.png'}
                  alt={node.name}
                  className={isUser ? 'w-16 h-16' : 'w-full h-full object-cover'}
                  style={{ imageRendering: 'pixelated' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.fallback-emoji')) {
                      const fallback = document.createElement('div');
                      fallback.innerHTML = '👤';
                      fallback.className = 'fallback-emoji text-2xl flex items-center justify-center w-full h-full';
                      fallback.style.imageRendering = 'pixelated';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
            </div>
            
            {/* Name label */}
            <div className={`absolute ${isUser ? 'top-22' : 'top-18'} left-1/2 transform -translate-x-1/2 text-center`}>
              <div 
                className={`text-xs text-gray-800 font-bold whitespace-nowrap ${
                  isUser ? 'max-w-24' : 'max-w-20'
                } truncate bg-white border-2 border-gray-400 px-2 py-1`}
                style={{
                  fontFamily: 'monospace',
                  imageRendering: 'pixelated',
                  boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,1)'
                }}
              >
                {isUser ? (node.name || 'USER') : node.name.split(' ')[0]}
              </div>
            </div>
          </div>
        );
      })}

      {/* Connection lines between all users */}
      <svg
        className="absolute pointer-events-none"
        style={{ 
          left: 0, 
          top: 0, 
          width: width, 
          height: height, 
          zIndex: 1
        }}
      >
        {data.connections.map((connection, index) => {
          const fromNode = nodes.find(n => n.id === connection.fromId);
          const toNode = nodes.find(n => n.id === connection.toId);
          
          if (!fromNode || !toNode) {
            console.log('Missing node for connection:', connection, { fromNode, toNode });
            return null;
          }
          
          // Now that nodes are positioned with left: x - nodeSize/2, top: y - nodeSize/2,
          // the node.x and node.y coordinates represent the visual center of each node.
          const fromCenterX = fromNode.x;
          const fromCenterY = fromNode.y;
          const toCenterX = toNode.x;
          const toCenterY = toNode.y;
          
          const isUserConnection = fromNode.isUser || toNode.isUser;
          const strokeWidth = isUserConnection ? 3 : 1.5;
          const opacity = isUserConnection ? 0.6 : 0.25;
          const strokeColor = isUserConnection ? "#6b7280" : "#d1d5db";
          const dashArray = isUserConnection ? "none" : "4,4";
          
          return (
            <line
              key={`connection-${connection.fromId}-${connection.toId}-${index}`}
              x1={fromCenterX}
              y1={fromCenterY}
              x2={toCenterX}
              y2={toCenterY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              opacity={opacity}
              style={{
                filter: `brightness(${0.8 + connection.strength * 0.4})`
              }}
            />
          );
        })}
      </svg>

      
      {/* Simple legend */}
      <div 
        className="absolute bottom-4 right-4 bg-white border-4 border-gray-600 p-3 z-20"
        style={{
          fontFamily: 'monospace',
          fontSize: '11px',
          imageRendering: 'pixelated',
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.3), inset 2px 2px 0px rgba(255,255,255,1), 4px 4px 0px rgba(0,0,0,0.2)'
        }}
      >
        <div className="text-xs font-bold mb-2 text-gray-800">CONTACT TYPES</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 border-2 border-gray-600 bg-white flex items-center justify-center"
              style={{ 
                imageRendering: 'pixelated',
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}
            >
              <span className="text-xs">👤</span>
            </div>
            <span className="text-gray-800 font-bold text-xs">YOU</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 border-2 border-green-600 bg-green-300 flex items-center justify-center"
              style={{ 
                imageRendering: 'pixelated',
                boxShadow: 'inset -1px -1px 0px rgba(0,0,0,0.3), inset 1px 1px 0px rgba(255,255,255,0.8)'
              }}
            >
              <span className="text-xs">👥</span>
            </div>
            <span className="text-gray-800 font-bold text-xs">CONTACTS</span>
          </div>
        </div>
      </div>
    </div>
  );
}