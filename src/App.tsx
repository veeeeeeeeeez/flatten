import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { supabase } from './supabaseClient';
import { format, parseISO, isSameDay } from 'date-fns';
import { Message, Filter, ActionStepIndex, MockActionItems, List } from './types';
import { fetchLists, addList } from "./api/lists";
import './styles/App.css';

export default function FlattenApp(): JSX.Element {
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [filter, setFilter] = useState<Filter>({ source: "All", tag: "All" });
  const [messages, setMessages] = useState<Message[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hasGmailToken, setHasGmailToken] = useState<boolean>(true);
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  
  // Lists functionality
  const [lists, setLists] = useState<List[]>([]);
  const [addingList, setAddingList] = useState<boolean>(false);
  const [newList, setNewList] = useState<string>("");
  const [loadingLists, setLoadingLists] = useState<boolean>(true);
  const listInputRef = useRef<HTMLInputElement>(null);

  // Get user initial for profile picture
  const [userInitial, setUserInitial] = useState<string>('U');
  
  useEffect(() => {
    async function fetchUserInitial(): Promise<void> {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (user && user.email) {
        setUserInitial(user.email[0].toUpperCase());
      }
    }
    fetchUserInitial();
  }, []);

  useEffect(() => {
    async function fetchMessages(): Promise<void> {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        alert(error.message);
      } else {
        setMessages(data || []);
      }
    }
    fetchMessages();
    checkGmailToken();
  }, []);

  // Fetch lists
  useEffect(() => {
    fetchLists().then(lists => {
      setLists(lists);
      setLoadingLists(false);
    });
  }, []);

  useEffect(() => {
    if (addingList && listInputRef.current) {
      listInputRef.current.focus();
    }
  }, [addingList]);


  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [showEmailComposer, setShowEmailComposer] = useState<boolean>(false);
  const [emailRecipient, setEmailRecipient] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailContent, setEmailContent] = useState<string>("");
  const [isRightPaneVisible, setIsRightPaneVisible] = useState<boolean>(true);
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(400);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Mock action items for each message
  const mockActionItems: MockActionItems = useMemo(() => ({
    1: [
      "Reply to Alex with the latest Stripe payment metrics.",
      "Forward this message to the finance team.",
      "Set a reminder for standup."
    ],
    2: [
      "Confirm your interview attendance.",
      "Add the interview to your calendar."
    ],
    3: [
      "React to Jenny's story.",
      "Share the story with your friends."
    ],
    4: [
      "Review the final draft of the deck.",
      "Send feedback to Marco."
    ],
    5: [
      "Read the weekly workspace summary.",
      "Check the 3 new shared pages."
    ],
    6: ["Acknowledge the Notion summary."],
    7: ["Acknowledge the Notion summary."],
    8: ["Acknowledge the Notion summary."],
    9: ["Acknowledge the Notion summary."],
    10: ["Acknowledge the Notion summary."],
    11: ["Acknowledge the Notion summary."]
  }), []);
  const [actionStepIdx, setActionStepIdx] = useState<ActionStepIndex>({});

  const handleLogout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) console.log('Error logging out:', error.message);
  };

  const handleAddList = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newList.trim()) return;
    try {
      const added = await addList(newList.trim());
      setLists((prev) => [added, ...prev]);
      setNewList("");
      setAddingList(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : JSON.stringify(error));
    }
  };

  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent): void => {
    if (!isDragging) return;
    
    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 400;
    const maxWidth = window.innerWidth - 700; // Ensure left pane has at least 500px
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setRightPaneWidth(newWidth);
    }
  };

  const handleMouseUp = (): void => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging]);

  // Removed unused keyboard handler

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (showProfileMenu && !(event.target as Element).closest('.fixed-profile-menu')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  // Global drag end listener to hide drop zone
  useEffect(() => {
    const handleGlobalDragEnd = () => {
      const searchBar = document.querySelector('.search-bar') as HTMLElement;
      if (searchBar) {
        searchBar.classList.remove('drag-over');
      }
    };

    document.addEventListener('dragend', handleGlobalDragEnd);
    return () => document.removeEventListener('dragend', handleGlobalDragEnd);
  }, []);

  const tagColor = (tag: string): string => {
    const map: { [key: string]: string } = {
      work: "bg-gray-100 text-gray-700",
      personal: "bg-pink-100 text-pink-700",
      urgent: "bg-red-100 text-red-700",
      design: "bg-orange-100 text-orange-700",
      payments: "bg-green-100 text-green-700",
      schedule: "bg-indigo-100 text-indigo-700",
      tools: "bg-gray-200 text-gray-700"
    };
    return map[tag] || "bg-gray-100 text-gray-600";
  };

  const allTags = [...new Set(messages.flatMap((m) => m.tags))];
  const allSources = [...new Set(messages.map((m) => m.source))];
  
  // Sort messages by timestamp descending (most recent first)
  const sortedMessages = [...messages].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });
  
  const filtered = sortedMessages.filter((m) => 
    (filter.source === "All" || m.source === filter.source) && 
    (filter.tag === "All" || (Array.isArray(m.tags) && m.tags.includes(filter.tag)))
  );

  const deleteMessage = (id: string): void => setMessages((msgs) => msgs.filter((m) => m.id !== id));

  // Replace Fetch Gmail button with a refresh that uses the /refresh-gmail endpoint
  const handleRefreshGmail = async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    console.log('User:', user);
    if (user && user.id) {
      setRefreshing(true);
      try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8081' 
          : 'https://flatten.onrender.com';
        
        console.log('Making request to:', `${apiBaseUrl}/refresh-gmail?user_id=${user.id}`);
        const res = await fetch(`${apiBaseUrl}/refresh-gmail?user_id=${user.id}`);
        console.log('Response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.log('Error response:', errorText);
          if (errorText.includes('No refresh token found')) {
            // Redirect to Gmail OAuth flow
            window.location.href = `${apiBaseUrl}/auth/google?user_id=${user.id}`;
            return;
          }
          throw new Error(errorText);
        }
        const result = await res.text();
        console.log('Success response:', result);
        
        // Re-fetch messages from Supabase
        await refreshMessages();
        // Update Gmail token status
        setHasGmailToken(true);
      } catch (err) {
        console.error('Fetch error:', err);
        alert('Failed to fetch Gmail: ' + (err instanceof Error ? err.message : 'Unknown error'));
      } finally {
        setRefreshing(false);
      }
    } else {
      alert('You must be logged in to refresh Gmail messages.');
    }
  };

  // Handle initial Gmail connection
  const handleConnectGmail = async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user && user.id) {
      const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:8081' 
        : 'https://flatten.onrender.com';
      window.location.href = `${apiBaseUrl}/auth/google?user_id=${user.id}`;
    } else {
      alert('You must be logged in to connect Gmail.');
    }
  };

  // Function to refresh messages from Supabase
  const refreshMessages = async (): Promise<void> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error refreshing messages:', error);
    } else {
      setMessages(data || []);
    }
  };

  // Function to check if user has Gmail token
  const checkGmailToken = async (): Promise<void> => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    
    if (user && user.id) {
      try {
        const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:8081' 
          : 'https://flatten.onrender.com';
        const res = await fetch(`${apiBaseUrl}/refresh-gmail?user_id=${user.id}`);
        setHasGmailToken(res.ok);
      } catch (err) {
        setHasGmailToken(false);
      }
    }
  };

      return (
      <div className={`app-container ${isDarkMode ? 'dark' : ''}`}>

      <div className="relative h-full flex-1">
        {/* Main Content */}
        <div 
          className={`center-container ${!isRightPaneVisible ? 'full-width' : ''}`}
          style={isRightPaneVisible ? { marginRight: `${rightPaneWidth}px` } : {}}
        >
          <div 
            className={`main-content ${!isRightPaneVisible ? 'full-width' : ''}`}
            style={isRightPaneVisible ? { marginRight: `${rightPaneWidth}px` } : {}}
          >
            <div className="filter-controls">
              <select onChange={(e) => setFilter(f => ({ ...f, source: e.target.value }))} className="filter-select">
                <option value="All">All Platforms</option>
                {allSources.map(s => <option key={s}>{s}</option>)}
              </select>
              <select onChange={(e) => setFilter(f => ({ ...f, tag: e.target.value }))} className="filter-select">
                <option value="All">All Tags</option>
                {allTags.map(t => <option key={t}>{t}</option>)}
              </select>
              {hasGmailToken ? (
                <button onClick={handleRefreshGmail} className="refresh-button" disabled={refreshing}>
                  {refreshing ? 'Refreshing...' : 'Refresh Gmail'}
                </button>
              ) : (
                <button onClick={handleConnectGmail} className="connect-button">
                  Connect Gmail
                </button>
              )}
            </div>
            <div 
              className={`messages-container ${!isRightPaneVisible ? 'full-width' : ''}`}
              style={isRightPaneVisible ? { marginRight: `${rightPaneWidth}px` } : {}}
            >
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-card">
                    <span className="empty-state-title">Connect Gmail</span>
                    <span className="empty-state-description">Import your emails to get started.</span>
                    <button onClick={handleRefreshGmail} className="empty-state-button" disabled={refreshing}>
                      {refreshing ? 'Refreshing...' : 'Refresh Gmail'}
                    </button>
                  </div>
                  <div className="empty-state-card-disabled">
                    <span className="empty-state-title">Connect Slack</span>
                    <span className="empty-state-description">(Coming soon)</span>
                    <button disabled className="empty-state-button-disabled">Connect Slack</button>
                  </div>
                </div>
              ) : (
                (() => {
                  let lastDate: Date | null = null;
                  function safeParseISO(ts: string): Date | null {
                    try {
                      if (!ts) return null;
                      const d = parseISO(ts);
                      if (isNaN(d.getTime())) return null;
                      return d;
                    } catch {
                      return null;
                    }
                  }
                  return filtered.map((msg, idx) => {
                    const dateObj = safeParseISO(msg.timestamp);
                    const showHeader = dateObj && (!lastDate || !isSameDay(dateObj, lastDate));
                    lastDate = dateObj;
                    return (
                      <React.Fragment key={msg.id}>
                        {showHeader && dateObj && (
                          <div className="date-header">{format(dateObj, 'MMMM d')}</div>
                        )}
                        <div>
                          <div
                            className={`message-card ${selectedMessages.has(msg.id) ? 'message-card-selected' : 'message-card-collapsed'}`}
                            onClick={() => {
                              setSelectedMessages(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(msg.id)) {
                                  newSet.delete(msg.id);
                                } else {
                                  newSet.add(msg.id);
                                }
                                return newSet;
                              });
                            }}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', msg.id);
                              
                              // Show drop zone immediately when dragging starts
                              const searchBar = document.querySelector('.search-bar') as HTMLElement;
                              if (searchBar) {
                                searchBar.classList.add('drag-over');
                              }
                              
                              // Create drag preview
                              const dragPreview = document.createElement('div');
                              dragPreview.className = 'drag-preview';
                              
                              // Decode content for preview
                              function decodeHTMLEntities(str: string): string {
                                const txt = document.createElement('textarea');
                                txt.innerHTML = str;
                                return txt.value;
                              }
                              
                              const senderName = msg.sender ? (() => {
                                const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                                if (match) {
                                  const name = decodeHTMLEntities(match[1]);
                                  return name;
                                } else {
                                  return decodeHTMLEntities(msg.sender);
                                }
                              })() : 'Unknown';
                              
                              const contentSnippet = msg.content ? decodeHTMLEntities(msg.content).substring(0, 100) + (msg.content.length > 100 ? '...' : '') : 'No content';
                              
                              dragPreview.innerHTML = `
                                <div class="drag-preview-content">
                                  <div class="drag-preview-sender">${senderName}</div>
                                  <div class="drag-preview-subject">${msg.subject || contentSnippet}</div>
                                </div>
                              `;
                              document.body.appendChild(dragPreview);
                              e.dataTransfer.setDragImage(dragPreview, 0, 0);
                              
                              // Remove preview after drag starts
                              setTimeout(() => {
                                document.body.removeChild(dragPreview);
                              }, 0);
                            }}
                          >
                            {/* Context line */}
                            <div className="context-line">
                              <div className="context-text">
                                {/* Gmail context */}
                                {msg.source === 'Gmail' && msg.subject && (
                                  <><span>Gmail</span><span>•</span><span className="context-source">{msg.subject}</span></>
                                )}
                                {/* Slack context */}
                                {msg.source === 'Slack' && msg.channel && (
                                  <><span>Slack</span><span>•</span><span className="font-mono">#{msg.channel}</span></>
                                )}
                                {/* DM context */}
                                {msg.is_dm && (
                                  <><span>Slack</span><span>•</span><span>DM with {msg.participants?.filter(p => p !== 'You').join(', ')}</span></>
                                )}
                                {/* Thread context */}
                                {msg.is_thread && msg.thread_parent_preview && (
                                  <>
                                    <span>↪ reply to "{msg.thread_parent_preview}"</span>
                                    {(msg.is_thread || msg.is_dm) && (
                                      <span className="thread-link" onClick={e => { e.stopPropagation(); alert('Show full thread for message ' + msg.id); }}>
                                        View full thread ↗
                                      </span>
                                    )}
                                  </>
                                )}
                                {/* Email context */}
                                {msg.source === 'Email' && msg.subject && (
                                  <><span>Email</span><span>•</span><span className="context-source">{msg.subject}</span></>
                                )}
                              </div>
                              <span className="timestamp">
                                {dateObj ? format(dateObj, 'p') : ''}
                              </span>
                            </div>
                            {/* Message header with profile image and sender info */}
                            <div className="message-header">
                              <div className="profile-image">
                                {(() => {
                                  function decodeHTMLEntities(str: string): string {
                                    const txt = document.createElement('textarea');
                                    txt.innerHTML = str;
                                    return txt.value;
                                  }
                                  
                                  if (msg.sender) {
                                    const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                                    if (match) {
                                      const name = decodeHTMLEntities(match[1]);
                                      return name.charAt(0).toUpperCase();
                                    } else {
                                      const sender = decodeHTMLEntities(msg.sender);
                                      return sender.charAt(0).toUpperCase();
                                    }
                                  }
                                  return 'U';
                                })()}
                              </div>
                              <div className="sender-info">
                                {msg.sender ? (
                                  (() => {
                                    function decodeHTMLEntities(str: string): string {
                                      const txt = document.createElement('textarea');
                                      txt.innerHTML = str;
                                      return txt.value;
                                    }
                                    const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                                    if (match) {
                                      const name = decodeHTMLEntities(match[1]);
                                      const email = decodeHTMLEntities(match[2]);
                                      return (
                                        <>
                                          <div className="sender-name">{name}</div>
                                          <div className="sender-email">{email}</div>
                                        </>
                                      );
                                    } else {
                                      const sender = decodeHTMLEntities(msg.sender);
                                      return <div className="sender-name">{sender}</div>;
                                    }
                                  })()
                                ) : (
                                  <div className="sender-name">Unknown Sender</div>
                                )}
                              </div>
                            </div>
                            {/* Message content */}
                            {(() => {
                              function decodeHTMLEntities(str: string): string {
                                const txt = document.createElement('textarea');
                                txt.innerHTML = str;
                                return txt.value;
                              }
                              const decodedContent = decodeHTMLEntities(msg.content);
                              const needsTruncation = decodedContent.length > 200;
                              const isExpanded = expandedMessages.has(msg.id);
                              
                              return (
                                <div className="message-content-wrapper">
                                  <div className={isExpanded ? "message-content" : "message-content-truncated"}>
                                    {decodedContent}
                                  </div>
                                  {needsTruncation && (
                                    <span 
                                      className="see-more-button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isExpanded) {
                                          setExpandedMessages(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(msg.id);
                                            return newSet;
                                          });
                                        } else {
                                          setExpandedMessages(prev => new Set([...prev, msg.id]));
                                        }
                                      }}
                                    >
                                      {isExpanded ? "See less" : "See more"}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="tags-container">
                              {Array.isArray(msg.tags) && msg.tags.map((tag, i) => (
                                <span key={i} className={`tag ${tagColor(tag)}`}>{tag}</span>
                              ))}
                            </div>
                            <div className="action-buttons">
                              <button onClick={e => { e.stopPropagation(); deleteMessage(msg.id); }} className="action-button">
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); alert('Choose list to add'); }} className="add-button"> <Plus className="w-4 h-4" /></button>
                            </div>
                          </div>
                          {/* Removed action items section */}
                        </div>
                      </React.Fragment>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
        
        {/* Search Bar at Bottom */}
        <div 
          className={`search-bar-container ${!isRightPaneVisible ? 'full-width' : ''}`}
          style={isRightPaneVisible ? { left: `calc(50% - ${rightPaneWidth / 2}px)` } : {}}
        >
          <div 
            className="search-bar"
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('drag-over');
              
              // Check if we're over the drop zone specifically
              const dropZone = e.currentTarget.querySelector('.drop-zone-expanded') as HTMLElement;
              if (dropZone) {
                const rect = dropZone.getBoundingClientRect();
                const x = e.clientX;
                const y = e.clientY;
                
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                  e.currentTarget.classList.add('drag-over-active');
                } else {
                  e.currentTarget.classList.remove('drag-over-active');
                }
              }
            }}
            onDragLeave={(e) => {
              // Only remove drag-over if we're leaving the entire search bar area
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX;
              const y = e.clientY;
              
              if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                e.currentTarget.classList.remove('drag-over');
                e.currentTarget.classList.remove('drag-over-active');
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              e.currentTarget.classList.remove('drag-over-active');
              const msgId = e.dataTransfer.getData('text/plain');
              if (msgId) {
                setSelectedMessages(prev => new Set([...prev, msgId]));
              }
            }}
            onDragEnd={() => {
              // Hide drop zone when drag ends
              const searchBar = document.querySelector('.search-bar') as HTMLElement;
              if (searchBar) {
                searchBar.classList.remove('drag-over');
                searchBar.classList.remove('drag-over-active');
              }
            }}
          >
            <div className="drop-zone-expanded">
              <div className="drop-zone-content">
                <div className="drop-zone-hash">#</div>
                <div className="drop-zone-text">Drop messages</div>
              </div>
            </div>
            {selectedMessages.size > 0 && (
              <div className="selected-messages-preview">
                {Array.from(selectedMessages).map(msgId => {
                  const msg = messages.find(m => m.id === msgId);
                  return msg ? (
                    <div key={msgId} className="selected-message-chip">
                      <div className="selected-message-content">
                        <div className="selected-message-sender">
                          {msg.sender ? (() => {
                            function decodeHTMLEntities(str: string): string {
                              const txt = document.createElement('textarea');
                              txt.innerHTML = str;
                              return txt.value;
                            }
                            const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                            if (match) {
                              const name = decodeHTMLEntities(match[1]);
                              return name;
                            } else {
                              return decodeHTMLEntities(msg.sender);
                            }
                          })() : 'Unknown'}
                        </div>
                        <div className="selected-message-subject">
                          {msg.subject || (msg.content ? (() => {
                            function decodeHTMLEntities(str: string): string {
                              const txt = document.createElement('textarea');
                              txt.innerHTML = str;
                              return txt.value;
                            }
                            const decodedContent = decodeHTMLEntities(msg.content);
                            return decodedContent.substring(0, 50) + (decodedContent.length > 50 ? '...' : '');
                          })() : 'No content')}
                        </div>
                      </div>
                      <button 
                        className="remove-message-button"
                        onClick={() => setSelectedMessages(prev => {
                          const newSet = new Set(prev);
                          newSet.delete(msgId);
                          return newSet;
                        })}
                      >
                        ×
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            <div className="search-input-container">
              <input
                type="text"
                className="search-input"
                placeholder="Ask about your messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // Extract recipient from selected messages
                    const selectedMsg = Array.from(selectedMessages)[0];
                    const msg = messages.find(m => m.id === selectedMsg);
                    let recipient = "";
                    
                    if (msg && msg.sender) {
                      function decodeHTMLEntities(str: string): string {
                        const txt = document.createElement('textarea');
                        txt.innerHTML = str;
                        return txt.value;
                      }
                      const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                      if (match) {
                        recipient = decodeHTMLEntities(match[2]); // Email address
                      } else {
                        recipient = decodeHTMLEntities(msg.sender);
                      }
                    }
                    
                    setEmailRecipient(recipient);
                    setEmailSubject("Re: " + (msg?.subject || ""));
                    setEmailContent(searchQuery);
                    setShowEmailComposer(true);
                    setSearchQuery("");
                  }
                }}
              />
              <button className="send-search-button">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="12" fill="black" />
                  <path d="M12 8V16M12 8L8 12M12 8L16 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Pane - Toggleable */}
        {isRightPaneVisible && (
          <div 
            className="right-pane" 
            style={{ 
              width: `${rightPaneWidth}px`, 
              right: 0, 
              position: 'fixed',
              top: 0,
              height: '100vh',
              backgroundColor: isDarkMode ? '#181A1B' : 'white',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div 
              className="resize-handle"
              onMouseDown={handleMouseDown}
            />
            <div className="right-pane-header">
              <button 
                onClick={() => setIsRightPaneVisible(false)}
                className="hide-pane-button"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="logo-container">
                <svg width="120" height="31" viewBox="0 0 610 157" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M140 10V140H10V10H140Z" stroke={isDarkMode ? "#BDB7AF" : "#1E1E1E"} strokeWidth="20"/>
                  <line x1="25" y1="115" x2="125" y2="115" stroke={isDarkMode ? "#BDB7AF" : "#1E1E1E"} strokeWidth="20"/>
                  <path d="M235.98 55.0909V69.8636H192.216V55.0909H235.98ZM202.234 126V49.9666C202.234 44.8269 203.234 40.5644 205.234 37.179C207.266 33.7936 210.036 31.2545 213.544 29.5618C217.053 27.8691 221.038 27.0227 225.501 27.0227C228.517 27.0227 231.271 27.2535 233.764 27.7152C236.288 28.1768 238.165 28.5923 239.396 28.9616L235.888 43.7344C235.118 43.4882 234.164 43.2573 233.026 43.0419C231.918 42.8265 230.779 42.7188 229.609 42.7188C226.716 42.7188 224.701 43.3958 223.562 44.75C222.423 46.0734 221.854 47.9354 221.854 50.3359V126H202.234ZM267.661 31.4545V126H247.994V31.4545H267.661ZM303.635 127.339C299.11 127.339 295.079 126.554 291.539 124.984C288 123.384 285.199 121.03 283.137 117.921C281.106 114.782 280.091 110.873 280.091 106.195C280.091 102.256 280.814 98.9474 282.26 96.2699C283.707 93.5923 285.676 91.438 288.169 89.8068C290.662 88.1757 293.494 86.9446 296.664 86.1136C299.864 85.2827 303.219 84.6979 306.728 84.3594C310.852 83.9285 314.176 83.5284 316.699 83.1591C319.223 82.759 321.054 82.1742 322.193 81.4048C323.332 80.6354 323.901 79.4967 323.901 77.9886V77.7116C323.901 74.7879 322.978 72.5258 321.131 70.9254C319.315 69.325 316.73 68.5249 313.375 68.5249C309.836 68.5249 307.02 69.3097 304.927 70.8793C302.834 72.4181 301.449 74.357 300.772 76.696L282.583 75.2188C283.507 70.91 285.323 67.1861 288.031 64.0469C290.739 60.8769 294.232 58.4455 298.51 56.7528C302.819 55.0294 307.805 54.1676 313.468 54.1676C317.407 54.1676 321.177 54.6293 324.778 55.5526C328.41 56.4759 331.626 57.907 334.426 59.8459C337.258 61.7848 339.489 64.2777 341.12 67.3246C342.752 70.3407 343.567 73.9569 343.567 78.1733V126H324.917V116.167H324.363C323.224 118.383 321.7 120.337 319.792 122.03C317.884 123.692 315.591 125 312.914 125.954C310.236 126.877 307.143 127.339 303.635 127.339ZM309.267 113.766C312.16 113.766 314.714 113.197 316.93 112.058C319.146 110.889 320.885 109.319 322.147 107.349C323.409 105.38 324.039 103.148 324.039 100.656V93.1307C323.424 93.5308 322.578 93.9001 321.5 94.2386C320.454 94.5464 319.269 94.8388 317.946 95.1158C316.622 95.362 315.299 95.5928 313.975 95.8082C312.652 95.9929 311.452 96.1622 310.375 96.316C308.066 96.6546 306.051 97.1932 304.327 97.9318C302.604 98.6705 301.265 99.6707 300.311 100.933C299.357 102.164 298.88 103.702 298.88 105.549C298.88 108.227 299.849 110.273 301.788 111.689C303.758 113.074 306.251 113.766 309.267 113.766ZM396.541 55.0909V69.8636H353.839V55.0909H396.541ZM363.533 38.1023H383.2V104.21C383.2 106.026 383.477 107.442 384.031 108.457C384.585 109.442 385.354 110.135 386.339 110.535C387.354 110.935 388.524 111.135 389.847 111.135C390.771 111.135 391.694 111.058 392.617 110.904C393.54 110.719 394.248 110.581 394.741 110.489L397.834 125.123C396.849 125.431 395.464 125.785 393.679 126.185C391.894 126.616 389.724 126.877 387.17 126.969C382.43 127.154 378.275 126.523 374.705 125.077C371.166 123.63 368.411 121.384 366.442 118.337C364.472 115.29 363.503 111.443 363.533 106.795V38.1023ZM447.069 55.0909V69.8636H404.366V55.0909H447.069ZM414.061 38.1023H433.727V104.21C433.727 106.026 434.004 107.442 434.558 108.457C435.112 109.442 435.881 110.135 436.866 110.535C437.882 110.935 439.051 111.135 440.375 111.135C441.298 111.135 442.221 111.058 443.145 110.904C444.068 110.719 444.776 110.581 445.268 110.489L448.361 125.123C447.376 125.431 445.991 125.785 444.206 126.185C442.421 126.616 440.252 126.877 437.697 126.969C432.958 127.154 428.803 126.523 425.233 125.077C421.693 123.63 418.939 121.384 416.969 118.337C414.999 115.29 414.03 111.443 414.061 106.795V38.1023ZM491.433 127.385C484.139 127.385 477.86 125.908 472.598 122.953C467.366 119.968 463.334 115.751 460.502 110.304C457.671 104.826 456.255 98.3473 456.255 90.8686C456.255 83.5746 457.671 77.1731 460.502 71.6641C463.334 66.1551 467.319 61.8617 472.459 58.7841C477.63 55.7064 483.693 54.1676 490.648 54.1676C495.326 54.1676 499.681 54.9216 503.713 56.4297C507.775 57.907 511.315 60.1383 514.331 63.1236C517.377 66.1089 519.747 69.8636 521.44 74.3878C523.133 78.8812 523.979 84.1439 523.979 90.1761V95.5774H464.103V83.3899H505.467C505.467 80.5585 504.851 78.0502 503.62 75.8651C502.389 73.6799 500.681 71.9718 498.496 70.7408C496.342 69.4789 493.833 68.848 490.971 68.848C487.986 68.848 485.339 69.5405 483.031 70.9254C480.753 72.2796 478.968 74.1108 477.676 76.419C476.383 78.6965 475.721 81.2356 475.691 84.0362V95.6236C475.691 99.1321 476.337 102.164 477.63 104.718C478.953 107.272 480.815 109.242 483.216 110.627C485.616 112.012 488.463 112.705 491.756 112.705C493.941 112.705 495.942 112.397 497.757 111.781C499.573 111.166 501.127 110.242 502.42 109.011C503.713 107.78 504.698 106.272 505.375 104.487L523.564 105.688C522.64 110.058 520.748 113.874 517.885 117.136C515.054 120.368 511.391 122.892 506.898 124.707C502.435 126.492 497.28 127.385 491.433 127.385ZM556.479 85.0057V126H536.813V55.0909H555.556V67.6016H556.387C557.956 63.4775 560.588 60.2152 564.281 57.8146C567.974 55.3833 572.452 54.1676 577.715 54.1676C582.639 54.1676 586.932 55.2448 590.595 57.3991C594.257 59.5535 597.104 62.6312 599.135 66.6321C601.167 70.6023 602.182 75.3419 602.182 80.8508V126H582.516V84.3594C582.547 80.0199 581.439 76.6345 579.192 74.2031C576.945 71.741 573.852 70.5099 569.913 70.5099C567.266 70.5099 564.927 71.0793 562.896 72.218C560.895 73.3568 559.326 75.0187 558.187 77.2038C557.079 79.3582 556.51 81.9588 556.479 85.0057Z" fill={isDarkMode ? "#BDB7AF" : "#1E1E1E"}/>
                </svg>
              </div>
              <div className="header-controls">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="dark-mode-toggle"
                  title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDarkMode ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
                    </svg>
                  )}
                </button>
                <div 
                  className="profile-circle"
                  onClick={() => setShowProfileMenu((v) => !v)}
                >
                  {userInitial}
                </div>
                {showProfileMenu && (
                  <div className="profile-dropdown">
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="profile-dropdown-item"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          <div className="actions-pane-content">
            {/* Email Action Card */}
            {showEmailComposer && (
              <div className="action-card">
                <div className="action-card-header">
                  <div className="action-card-icon">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  <div className="action-card-title">Send Email Response</div>
                  <button 
                    onClick={() => setShowEmailComposer(false)} 
                    className="action-card-close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="action-card-content">
                  <div className="email-field">
                    <label className="email-label">To:</label>
                    <input
                      type="email"
                      className="email-input"
                      value={emailRecipient}
                      onChange={(e) => setEmailRecipient(e.target.value)}
                      placeholder="recipient@example.com"
                    />
                  </div>
                  <div className="email-field">
                    <label className="email-label">Subject:</label>
                    <input
                      type="text"
                      className="email-input"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject"
                    />
                  </div>
                  <div className="email-field">
                    <label className="email-label">Message:</label>
                    <textarea
                      className="email-textarea"
                      value={emailContent}
                      onChange={(e) => setEmailContent(e.target.value)}
                      placeholder="Type your message here..."
                      rows={12}
                    />
                  </div>
                  <div className="email-actions">
                    <button 
                      className="send-email-button"
                      onClick={() => {
                        // TODO: Implement actual email sending
                        alert('Email would be sent to: ' + emailRecipient);
                        setShowEmailComposer(false);
                      }}
                    >
                      Send Email
                    </button>
                    <button 
                      className="save-draft-button"
                      onClick={() => {
                        alert('Draft saved');
                      }}
                    >
                      Save Draft
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Lists Section */}
            <div className="lists-section">
              <div className="lists-header">
                <h3 className="lists-title">Lists</h3>
                <button 
                  className="add-list-button"
                  onClick={() => {
                    setAddingList(true);
                    setNewList("");
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {addingList && (
                <form onSubmit={handleAddList} className="add-form">
                  <input
                    ref={listInputRef}
                    value={newList}
                    onChange={e => setNewList(e.target.value)}
                    placeholder="New list name"
                    className="add-input"
                    onBlur={() => { setAddingList(false); setNewList(""); }}
                  />
                </form>
              )}
              {loadingLists ? (
                <div className="loading-text">Loading...</div>
              ) : (
                <div className="lists-content">
                  {lists.map(list => (
                    <div key={list.id} className="list-item">
                      <div className="list-item-icon">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <span className="list-item-name">{list.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        
        {/* Show Pane Button - When Right Pane is Hidden */}
        {!isRightPaneVisible && (
          <button 
            onClick={() => setIsRightPaneVisible(true)}
            className="show-pane-button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
} 