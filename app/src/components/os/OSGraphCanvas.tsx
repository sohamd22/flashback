'use client';

import { useState, useRef, useEffect } from 'react';
import { GraphData, GraphNode, GraphConnection } from '@/types/graph';
import UserNode from '@/components/nodes/UserNode';
import FriendNode from '@/components/nodes/FriendNode';
import GraphConnectionComponent from '@/components/connections/GraphConnection';

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

  // Center and scale nodes to fit the window
  useEffect(() => {
    if (!data.nodes.length) return;

    const centerX = width / 2;
    const centerY = height / 2;
    
    // Find user node
    const userNode = data.nodes.find(n => n.isUser);
    if (!userNode) return;

    // Scale factor to fit nicely in window
    const scale = Math.min(width / 1000, height / 700, 1);

    const centeredNodes = data.nodes.map(node => {
      if (node.isUser) {
        return { ...node, x: centerX, y: centerY };
      }
      
      // Scale and center friend nodes relative to user
      const offsetX = (node.x - userNode.x) * scale;
      const offsetY = (node.y - userNode.y) * scale;
      
      return {
        ...node,
        x: centerX + offsetX,
        y: centerY + offsetY
      };
    });

    setNodes(centeredNodes);
  }, [data, width, height]);

  // Apply grayscale based on mutual memories
  const getNodeStyle = (node: GraphNode) => {
    if (node.isUser) return {};
    
    const connection = data.connections.find(c => 
      (c.fromId === 'user' && c.toId === node.id) ||
      (c.fromId === node.id && c.toId === 'user')
    );
    
    if (!connection) return {};
    
    // Find max mutual memories for normalization
    const maxMemories = Math.max(...data.connections.map(c => c.mutualMemories || 0));
    const normalizedMemories = (connection.mutualMemories || 0) / maxMemories;
    
    // Grayscale inversely proportional to memories (0-0.875)
    const grayscale = 0.875 - (normalizedMemories * 0.875);
    
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
      // Animate back to original position
      const originalNode = data.nodes.find(n => n.id === dragState.nodeId);
      if (originalNode) {
        const centerX = width / 2;
        const centerY = height / 2;
        const userNode = data.nodes.find(n => n.isUser);
        const scale = Math.min(width / 1000, height / 700, 1);
        
        let targetX = centerX;
        let targetY = centerY;
        
        if (!currentNode.isUser && userNode) {
          const offsetX = (originalNode.x - userNode.x) * scale;
          const offsetY = (originalNode.y - userNode.y) * scale;
          targetX = centerX + offsetX;
          targetY = centerY + offsetY;
        }
        
        animateNodeBack(dragState.nodeId, { x: currentNode.x, y: currentNode.y }, { x: targetX, y: targetY });
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

  const renderConnection = (connection: GraphConnection) => {
    const fromNode = nodes.find(n => n.id === connection.fromId);
    const toNode = nodes.find(n => n.id === connection.toId);
    
    if (!fromNode || !toNode) return null;
    
    return (
      <div key={`${connection.fromId}-${connection.toId}`} style={{ zIndex: 1 }}>
        <GraphConnectionComponent
          from={{ x: fromNode.x, y: fromNode.y }}
          to={{ x: toNode.x, y: toNode.y }}
          strength={connection.strength}
          canvasWidth={width}
          canvasHeight={height}
        />
      </div>
    );
  };

  const renderNode = (node: GraphNode) => {
    const isDragging = dragState.nodeId === node.id;
    const isHovered = hoveredNode === node.id;
    const nodeStyle = getNodeStyle(node);
    
    if (node.isUser) {
      return (
        <div key={node.id} style={{ ...nodeStyle, zIndex: 10 }}>
          <UserNode
            id={node.id}
            name={node.name}
            photo={node.photo}
            x={node.x}
            y={node.y}
            isHovered={isHovered}
            showLabel={false} // Disable label popup
            onClick={onUserClick}
            onMouseEnter={() => !dragState.isDragging && setHoveredNode(node.id)}
            onMouseLeave={() => !dragState.isDragging && setHoveredNode(null)}
          />
        </div>
      );
    }
    
    return (
      <div key={node.id} style={{ ...nodeStyle, zIndex: 5 }}>
        <FriendNode
          name={node.name}
          photo={node.photo}
          x={node.x}
          y={node.y}
          isDragging={isDragging}
          isHovered={false} // Disable hover popup
          onClick={() => {
            if (!dragState.isDragging && onFriendClick) {
              onFriendClick(node.id);
            }
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
        />
      </div>
    );
  };

  return (
    <div 
      className="relative"
      style={{ width, height }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Starry background */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" style={{
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, #eee, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90px 40px, #fff, transparent),
            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
            radial-gradient(2px 2px at 160px 30px, #eee, transparent),
            radial-gradient(1px 1px at 200px 60px, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 250px 20px, #fff, transparent),
            radial-gradient(2px 2px at 280px 90px, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 320px 50px, #eee, transparent),
            radial-gradient(1px 1px at 360px 10px, rgba(255,255,255,0.8), transparent)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 100px'
        }} />
      </div>

      {data.connections.map(connection => renderConnection(connection))}
      {nodes.map(node => renderNode(node))}
      
      {/* Legend - positioned in bottom right */}
      <div 
        className="absolute bottom-4 right-4 bg-gray-300 border-4 border-gray-800 p-3 z-20"
        style={{
          boxShadow: 'inset -2px -2px 0px rgba(0,0,0,0.5), inset 2px 2px 0px rgba(255,255,255,0.8), 4px 4px 0px rgba(0,0,0,0.3)',
          fontFamily: 'monospace',
          fontSize: '11px'
        }}
      >
        <h4 className="text-xs font-bold mb-2 text-black">CONNECTION STRENGTH</h4>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 border border-gray-600"
              style={{ 
                backgroundColor: 'rgba(156, 163, 175, 0.4)',
                boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
              }}
            />
            <span className="text-black font-bold text-xs">FEW MEMORIES</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 border border-gray-600"
              style={{ 
                backgroundColor: 'rgba(156, 163, 175, 0.6)',
                boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
              }}
            />
            <span className="text-black font-bold text-xs">SOME MEMORIES</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 border border-gray-600"
              style={{ 
                backgroundColor: 'rgba(156, 163, 175, 0.8)',
                boxShadow: 'inset 1px 1px 0px rgba(0,0,0,0.2)'
              }}
            />
            <span className="text-black font-bold text-xs">MANY MEMORIES</span>
          </div>
        </div>
      </div>
    </div>
  );
}