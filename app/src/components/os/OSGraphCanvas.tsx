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

  // Use positions from data (already optimized by MDS algorithm)
  useEffect(() => {
    if (!data.nodes.length) return;
    setNodes([...data.nodes]);
  }, [data]);

  // Apply grayscale based on interactions with current user
  const getNodeStyle = (node: GraphNode) => {
    if (node.isUser) return {};
    
    const currentUserId = data.nodes.find(n => n.isUser)?.id;
    if (!currentUserId) return {};
    
    const connection = data.connections.find(c => 
      (c.fromId === currentUserId && c.toId === node.id) ||
      (c.fromId === node.id && c.toId === currentUserId)
    );
    
    if (!connection) return { filter: 'grayscale(0.8)' };
    
    // Find max interactions for normalization
    const maxInteractions = Math.max(...data.connections.map(c => c.interactions || 0));
    const normalizedInteractions = (connection.interactions || 0) / maxInteractions;
    
    // Grayscale inversely proportional to interactions (0-0.8)
    const grayscale = 0.8 - (normalizedInteractions * 0.6);
    
    return {
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
      // Animate back to original MDS position
      const originalNode = data.nodes.find(n => n.id === dragState.nodeId);
      if (originalNode) {
        animateNodeBack(dragState.nodeId, { x: currentNode.x, y: currentNode.y }, { x: originalNode.x, y: originalNode.y });
      }
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
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ 
              left: node.x, 
              top: node.y,
              zIndex: isUser ? 15 : (isDragging ? 20 : 5),
              transform: isDragging ? 'translate(-50%, -50%) scale(1.1)' : 'translate(-50%, -50%) scale(1)',
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
          
          if (!fromNode || !toNode) return null;
          
          const isUserConnection = fromNode.isUser || toNode.isUser;
          const strokeWidth = isUserConnection ? 3 : 1.5;
          const opacity = isUserConnection ? 0.6 : 0.25;
          const strokeColor = isUserConnection ? "#6b7280" : "#d1d5db";
          const dashArray = isUserConnection ? "none" : "4,4";
          
          return (
            <line
              key={`connection-${connection.fromId}-${connection.toId}-${index}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
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