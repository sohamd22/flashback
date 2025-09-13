'use client';

import { useState, useRef, useEffect } from 'react';
import { GraphData, GraphNode, GraphConnection } from '@/types/graph';
import CanvasLayout from '@/components/layouts/CanvasLayout';
import UserNode from '@/components/nodes/UserNode';
import FriendNode from '@/components/nodes/FriendNode';
import GraphConnectionComponent from '@/components/connections/GraphConnection';
import Tooltip from '@/components/ui/Tooltip';
import Legend from '@/components/ui/Legend';

interface GraphCanvasProps {
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

export default function GraphCanvas({ data, width, height, onUserClick, onFriendClick }: GraphCanvasProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>(data.nodes);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    offset: { x: 0, y: 0 },
    originalPosition: { x: 0, y: 0 }
  });
  const animationRef = useRef<number>(0);

  useEffect(() => {
    setNodes(data.nodes);
  }, [data]);

  const getOriginalPosition = (nodeId: string) => {
    const originalNode = data.nodes.find(n => n.id === nodeId);
    return originalNode ? { x: originalNode.x, y: originalNode.y } : { x: 0, y: 0 };
  };

  const animateNodeBack = (nodeId: string, currentPos: { x: number; y: number }) => {
    const originalPos = getOriginalPosition(nodeId);
    const startTime = performance.now();
    const duration = 600;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOutElastic = (t: number) => {
        const c4 = (2 * Math.PI) / 4.5;
        return t === 0
          ? 0
          : t === 1
          ? 1
          : Math.pow(2, -8 * t) * Math.sin((t * 8 - 0.75) * c4) + 1;
      };

      const easedProgress = easeOutElastic(progress);
      
      const newX = currentPos.x + (originalPos.x - currentPos.x) * easedProgress;
      const newY = currentPos.y + (originalPos.y - currentPos.y) * easedProgress;

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
      animateNodeBack(dragState.nodeId, { x: currentNode.x, y: currentNode.y });
    }

    setDragState({
      isDragging: false,
      nodeId: null,
      offset: { x: 0, y: 0 },
      originalPosition: { x: 0, y: 0 }
    });
  };

  const renderConnection = (connection: GraphConnection) => {
    const fromNode = nodes.find(n => n.id === connection.fromId);
    const toNode = nodes.find(n => n.id === connection.toId);
    
    if (!fromNode || !toNode) return null;
    
    return (
      <GraphConnectionComponent
        key={`${connection.fromId}-${connection.toId}`}
        from={{ x: fromNode.x, y: fromNode.y }}
        to={{ x: toNode.x, y: toNode.y }}
        strength={connection.strength}
        canvasWidth={width}
        canvasHeight={height}
      />
    );
  };

  const renderNode = (node: GraphNode) => {
    const isDragging = dragState.nodeId === node.id;
    const isHovered = hoveredNode === node.id;
    
    if (node.isUser) {
      return (
        <UserNode
          key={node.id}
          id={node.id}
          name={node.name}
          photo={node.photo}
          x={node.x}
          y={node.y}
          isHovered={isHovered}
          onClick={onUserClick}
          onMouseEnter={() => !dragState.isDragging && setHoveredNode(node.id)}
          onMouseLeave={() => !dragState.isDragging && setHoveredNode(null)}
        />
      );
    }
    
    return (
      <FriendNode
        key={node.id}
        name={node.name}
        photo={node.photo}
        x={node.x}
        y={node.y}
        isDragging={isDragging}
        isHovered={isHovered}
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
    );
  };

  const legendItems = [
    { color: 'rgba(156, 163, 175, 0.4)', label: 'Few memories', description: '(distant)' },
    { color: 'rgba(156, 163, 175, 0.6)', label: 'Some memories', description: '(closer)' },
    { color: 'rgba(156, 163, 175, 0.8)', label: 'Many memories', description: '(closest)' }
  ];

  return (
    <CanvasLayout
      className="border border-gray-700"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{ width, height }}>
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {data.connections.map(connection => renderConnection(connection))}
        
        {nodes.map(node => renderNode(node))}
        
        {hoveredNode && !dragState.isDragging && (
          <Tooltip position="top-left">
            {(() => {
              const node = nodes.find(n => n.id === hoveredNode);
              const userConnection = data.connections.find(c => 
                (c.fromId === 'user' && c.toId === hoveredNode) ||
                (c.fromId === hoveredNode && c.toId === 'user')
              );
              
              return (
                <div>
                  <h3 className="font-semibold text-white text-lg">{node?.name}</h3>
                  {userConnection && !node?.isUser && (
                    <p className="text-sm text-gray-300 mt-1">
                      {userConnection.mutualMemories} shared memories
                    </p>
                  )}
                  {node?.isUser && (
                    <p className="text-sm text-gray-300 mt-1">
                      That's you! Click to view your memories →
                    </p>
                  )}
                </div>
              );
            })()}
          </Tooltip>
        )}
        
        <Legend
          title="Connection Strength"
          items={legendItems}
          position="bottom-right"
        />
      </div>
    </CanvasLayout>
  );
}