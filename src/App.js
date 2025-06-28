// Flatten Wireframe – Adds Side Pane for Lists, Right Pane for Message Details, Drag & Drop, and Controls
import React, { useState, useEffect } from "react";
import { Mic, X, Trash2, Plus, ChevronLeft, ChevronRight} from "lucide-react";
import { supabase } from './supabaseClient';
import ListsPane from './ListsPane';
import { format, parseISO, isSameDay } from 'date-fns';

export default function FlattenApp() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [filter, setFilter] = useState({ source: "All", tag: "All" });
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        alert(error.message);
      } else {
        setMessages(data);
      }
    }
    fetchMessages();
  }, []);
  const [isLeftPaneOpen, setIsLeftPaneOpen] = useState(true);
  const [expandedMsgId, setExpandedMsgId] = useState(null);

  // Mock action items for each message
  const mockActionItems = {
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
  };
  const [actionStepIdx, setActionStepIdx] = useState({});

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.log('Error logging out:', error.message)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Global Tab/Y/N override for action items
  useEffect(() => {
    const handleKey = (e) => {
      if (expandedMsgId && mockActionItems[expandedMsgId]) {
        if (e.key === 'Tab') {
          e.preventDefault();
          setActionStepIdx(idxObj => ({
            ...idxObj,
            [expandedMsgId]: ((idxObj[expandedMsgId] || 0) + 1) % mockActionItems[expandedMsgId].length
          }));
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          const idx = actionStepIdx[expandedMsgId] || 0;
          alert('Accepted: ' + mockActionItems[expandedMsgId][idx]);
        } else if (e.key.toLowerCase() === 'n') {
          e.preventDefault();
          const idx = actionStepIdx[expandedMsgId] || 0;
          alert('Rejected: ' + mockActionItems[expandedMsgId][idx]);
        }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [expandedMsgId, mockActionItems, setActionStepIdx, actionStepIdx]);

  const tagColor = (tag) => {
    const map = {
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
  const filtered = sortedMessages.filter((m) => (filter.source === "All" || m.source === filter.source) && (filter.tag === "All" || (Array.isArray(m.tags) && m.tags.includes(filter.tag))));

  const deleteMessage = (id) => setMessages((msgs) => msgs.filter((m) => m.id !== id));

  // Add this function to trigger Gmail fetch
  const handleFetchGmail = async () => {
    let user = null;
    if (supabase.auth.getUser) {
      // Newer SDK
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } else {
      // Older SDK
      user = supabase.auth.user();
    }
    if (user && user.id) {
      window.location.href = `http://localhost:8081/auth/google?user_id=${user.id}`;
    } else {
      alert('You must be logged in to fetch Gmail messages.');
    }
  };

  return (
    <div className="bg-gray-50 text-black h-screen w-screen flex flex-col font-mono relative">
      <div className="absolute top-4 right-6 flex gap-2">
        <button onClick={handleFetchGmail} className="p-2 rounded bg-blue-500 text-white z-50">
          Fetch Gmail
        </button>
        <button onClick={handleLogout} className="p-2 rounded bg-red-500 text-white z-50">
          LOGOUT
        </button>
      </div>
      <div className="relative h-full flex-1">
        {/* Left Pane */}
        <div className={`fixed top-0 left-0 h-full flex flex-col bg-white border-r border-gray-200 z-20 transition-all duration-200 ${isLeftPaneOpen ? 'w-60' : 'w-12'}`}>
          {/* Header */}
          {isLeftPaneOpen ? (
            <div className="flex items-center justify-center pt-3 pb-2 px-2" style={{ minHeight: 56 }}>
              <svg width="120" height="30" viewBox="0 0 603 150" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="10" y="10" width="130" height="130" fill="white" stroke="#1E1E1E" strokeWidth="20"/>
              <line x1="25" y1="115" x2="125" y2="115" stroke="#1E1E1E" strokeWidth="20"/>
                <path d="M235.98 55.0909V69.8636H192.216V55.0909H235.98ZM202.234 126V49.9666C202.234 44.8269 203.234 40.5644 205.234 37.179C207.266 33.7936 210.036 31.2545 213.544 29.5618C217.053 27.8691 221.038 27.0227 225.501 27.0227C228.517 27.0227 231.271 27.2535 233.764 27.7152C236.288 28.1768 238.165 28.5923 239.396 28.9616L235.888 43.7344C235.118 43.4882 234.164 43.2573 233.026 43.0419C231.918 42.8265 230.779 42.7188 229.609 42.7188C226.716 42.7188 224.701 43.3958 223.562 44.75C222.423 46.0734 221.854 47.9354 221.854 50.3359V126H202.234ZM267.661 31.4545V126H247.994V31.4545H267.661ZM303.635 127.339C299.11 127.339 295.079 126.554 291.539 124.984C288 123.384 285.199 121.03 283.137 117.921C281.106 114.782 280.091 110.873 280.091 106.195C280.091 102.256 280.814 98.9474 282.26 96.2699C283.707 93.5923 285.676 91.438 288.169 89.8068C290.662 88.1757 293.494 86.9446 296.664 86.1136C299.864 85.2827 303.219 84.6979 306.728 84.3594C310.852 83.9285 314.176 83.5284 316.699 83.1591C319.223 82.759 321.054 82.1742 322.193 81.4048C323.332 80.6354 323.901 79.4967 323.901 77.9886V77.7116C323.901 74.7879 322.978 72.5258 321.131 70.9254C319.315 69.325 316.73 68.5249 313.375 68.5249C309.836 68.5249 307.02 69.3097 304.927 70.8793C302.834 72.4181 301.449 74.357 300.772 76.696L282.583 75.2188C283.507 70.91 285.323 67.1861 288.031 64.0469C290.739 60.8769 294.232 58.4455 298.51 56.7528C302.819 55.0294 307.805 54.1676 313.468 54.1676C317.407 54.1676 321.177 54.6293 324.778 55.5526C328.41 56.4759 331.626 57.907 334.426 59.8459C337.258 61.7848 339.489 64.2777 341.12 67.3246C342.752 70.3407 343.567 73.9569 343.567 78.1733V126H324.917V116.167H324.363C323.224 118.383 321.7 120.337 319.792 122.03C317.884 123.692 315.591 125 312.914 125.954C310.236 126.877 307.143 127.339 303.635 127.339ZM309.267 113.766C312.16 113.766 314.714 113.197 316.93 112.058C319.146 110.889 320.885 109.319 322.147 107.349C323.409 105.38 324.039 103.148 324.039 100.656V93.1307C323.424 93.5308 322.578 93.9001 321.5 94.2386C320.454 94.5464 319.269 94.8388 317.946 95.1158C316.622 95.362 315.299 95.5928 313.975 95.8082C312.652 95.9929 311.452 96.1622 310.375 96.316C308.066 96.6546 306.051 97.1932 304.327 97.9318C302.604 98.6705 301.265 99.6707 300.311 100.933C299.357 102.164 298.88 103.702 298.88 105.549C298.88 108.227 299.849 110.273 301.788 111.689C303.758 113.074 306.251 113.766 309.267 113.766ZM396.541 55.0909V69.8636H353.839V55.0909H396.541ZM363.533 38.1023H383.2V104.21C383.2 106.026 383.477 107.442 384.031 108.457C384.585 109.442 385.354 110.135 386.339 110.535C387.354 110.935 388.524 111.135 389.847 111.135C390.771 111.135 391.694 111.058 392.617 110.904C393.54 110.719 394.248 110.581 394.741 110.489L397.834 125.123C396.849 125.431 395.464 125.785 393.679 126.185C391.894 126.616 389.724 126.877 387.17 126.969C382.43 127.154 378.275 126.523 374.705 125.077C371.166 123.63 368.411 121.384 366.442 118.337C364.472 115.29 363.503 111.443 363.533 106.795V38.1023ZM447.069 55.0909V69.8636H404.366V55.0909H447.069ZM414.061 38.1023H433.727V104.21C433.727 106.026 434.004 107.442 434.558 108.457C435.112 109.442 435.881 110.135 436.866 110.535C437.882 110.935 439.051 111.135 440.375 111.135C441.298 111.135 442.221 111.058 443.145 110.904C444.068 110.719 444.776 110.581 445.268 110.489L448.361 125.123C447.376 125.431 445.991 125.785 444.206 126.185C442.421 126.616 440.252 126.877 437.697 126.969C432.958 127.154 428.803 126.523 425.233 125.077C421.693 123.63 418.939 121.384 416.969 118.337C414.999 115.29 414.03 111.443 414.061 106.795V38.1023ZM491.433 127.385C484.139 127.385 477.86 125.908 472.598 122.953C467.366 119.968 463.334 115.751 460.502 110.304C457.671 104.826 456.255 98.3473 456.255 90.8686C456.255 83.5746 457.671 77.1731 460.502 71.6641C463.334 66.1551 467.319 61.8617 472.459 58.7841C477.63 55.7064 483.693 54.1676 490.648 54.1676C495.326 54.1676 499.681 54.9216 503.713 56.4297C507.775 57.907 511.315 60.1383 514.331 63.1236C517.377 66.1089 519.747 69.8636 521.44 74.3878C523.133 78.8812 523.979 84.1439 523.979 90.1761V95.5774H464.103V83.3899H505.467C505.467 80.5585 504.851 78.0502 503.62 75.8651C502.389 73.6799 500.681 71.9718 498.496 70.7408C496.342 69.4789 493.833 68.848 490.971 68.848C487.986 68.848 485.339 69.5405 483.031 70.9254C480.753 72.2796 478.968 74.1108 477.676 76.419C476.383 78.6965 475.721 81.2356 475.691 84.0362V95.6236C475.691 99.1321 476.337 102.164 477.63 104.718C478.953 107.272 480.815 109.242 483.216 110.627C485.616 112.012 488.463 112.705 491.756 112.705C493.941 112.705 495.942 112.397 497.757 111.781C499.573 111.166 501.127 110.242 502.42 109.011C503.713 107.78 504.698 106.272 505.375 104.487L523.564 105.688C522.64 110.058 520.748 113.874 517.885 117.136C515.054 120.368 511.391 122.892 506.898 124.707C502.435 126.492 497.28 127.385 491.433 127.385ZM556.479 85.0057V126H536.813V55.0909H555.556V67.6016H556.387C557.956 63.4775 560.588 60.2152 564.281 57.8146C567.974 55.3833 572.452 54.1676 577.715 54.1676C582.639 54.1676 586.932 55.2448 590.595 57.3991C594.257 59.5535 597.104 62.6312 599.135 66.6321C601.167 70.6023 602.182 75.3419 602.182 80.8508V126H582.516V84.3594C582.547 80.0199 581.439 76.6345 579.192 74.2031C576.945 71.741 573.852 70.5099 569.913 70.5099C567.266 70.5099 564.927 71.0793 562.896 72.218C560.895 73.3568 559.326 75.0187 558.187 77.2038C557.079 79.3582 556.51 81.9588 556.479 85.0057Z" fill="#1E1E1E"/>
              </svg>
            </div>
          ) : (
            <div className="flex items-center justify-center pt-3 pb-2 px-2" style={{ minHeight: 56 }}>
              <svg width="32" height="32" viewBox="0 0 150 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="130" height="130" fill="white" stroke="#1E1E1E" strokeWidth="20"/>
                <line x1="25" y1="115" x2="125" y2="115" stroke="#1E1E1E" strokeWidth="20"/>
              </svg>
            </div>
          )}
          {/* Chevron always at top right */}
          <div className="flex items-center justify-end px-2 pb-2">
            <button onClick={() => setIsLeftPaneOpen(open => !open)} className="p-1 rounded hover:bg-gray-100">
              {isLeftPaneOpen ? (
                <ChevronLeft className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex-1 space-y-3 p-4">
            {isLeftPaneOpen ? (
              <ListsPane />
            ) : (
              <div className="flex flex-col items-center">
                {/* Optionally show icons or placeholders when collapsed */}
              </div>
            )}
          </div>
        </div>
        {/* Centered Middle Pane */}
        <div className="flex justify-center items-start min-h-screen bg-gray-50">
          <div className="w-full max-w-2xl pt-8 bg-gray-50">
            <div className="mb-4 flex gap-4 text-sm px-4">
          <select onChange={(e) => setFilter(f => ({ ...f, source: e.target.value }))} className="p-2 border rounded text-black">
            <option value="All">All Platforms</option>
            {allSources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select onChange={(e) => setFilter(f => ({ ...f, tag: e.target.value }))} className="p-2 border rounded text-black">
            <option value="All">All Tags</option>
            {allTags.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
            <div className="w-full px-4 overflow-y-auto space-y-4 transition-all duration-200 pb-32 bg-gray-50">
              {(() => {
                let lastDate = null;
                function safeParseISO(ts) {
                  try {
                    if (!ts) return null;
                    const d = parseISO(ts);
                    if (isNaN(d)) return null;
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
                        <div className="text-lg font-bold text-gray-500 mt-8 mb-2">{format(dateObj, 'MMMM d')}</div>
                      )}
                      <div>
                        <div
                          className={`border border-gray-200 p-4 bg-white relative hover:bg-gray-50 cursor-pointer group ${expandedMsgId === msg.id ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'}`}
                          onClick={() => setExpandedMsgId(expandedMsgId === msg.id ? null : msg.id)}
                        >
                          {/* Context line */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                              {/* Gmail context */}
                              {msg.source === 'Gmail' && msg.subject && (
                                <><span>Gmail</span><span>•</span><span className="font-mono truncate max-w-[180px] inline-block align-middle">{msg.subject}</span></>
                              )}
                              {/* Slack context */}
                              {msg.source === 'Slack' && msg.channel && (
                                <><span>Slack</span><span>•</span><span className="font-mono">#{msg.channel}</span></>
                              )}
                              {/* DM context */}
                              {msg.isDM && (
                                <><span>Slack</span><span>•</span><span>DM with {msg.participants?.filter(p => p !== 'You').join(', ')}</span></>
                              )}
                              {/* Thread context */}
                              {msg.isThread && msg.threadParentPreview && (
                                <>
                                  <span>↪ reply to "{msg.threadParentPreview}"</span>
                                  {(msg.isThread || msg.isDM) && (
                                    <span className="text-blue-500 cursor-pointer select-none ml-1 inline-block opacity-0 group-hover:opacity-100 transition" onClick={e => { e.stopPropagation(); alert('Show full thread for message ' + msg.id); }}>
                                      View full thread ↗
                                    </span>
                                  )}
                                </>
                              )}
                              {/* Email context */}
                              {msg.source === 'Email' && msg.subject && (
                                <><span>Email</span><span>•</span><span className="font-mono truncate max-w-[180px] inline-block align-middle">{msg.subject}</span></>
                              )}
                            </div>
                            <span className="text-xs text-gray-400 ml-4 whitespace-nowrap">
                              {dateObj ? format(dateObj, 'p') : ''}
                            </span>
                          </div>
                          {/* Main message row */}
                          <div className="text-sm mt-1 whitespace-pre-wrap">
                            {msg.sender ? (
                              (() => {
                                function decodeHTMLEntities(str) {
                                  const txt = document.createElement('textarea');
                                  txt.innerHTML = str;
                                  return txt.value;
                                }
                                const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                                if (match) {
                                  const name = decodeHTMLEntities(match[1]);
                                  const email = decodeHTMLEntities(match[2]);
                                  return <><span style={{ fontWeight: 'bold' }}>{name}</span> &lt;{email}&gt;: </>;
                                } else {
                                  return decodeHTMLEntities(msg.sender) + ': ';
                                }
                              })()
                            ) : ''}
                            {(() => {
                              function decodeHTMLEntities(str) {
                                const txt = document.createElement('textarea');
                                txt.innerHTML = str;
                                return txt.value;
                              }
                              return decodeHTMLEntities(msg.content);
                            })()}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {Array.isArray(msg.tags) && msg.tags.map((tag, i) => (
                              <span key={i} className={`text-xs px-2 py-1 rounded-full ${tagColor(tag)}`}>{tag}</span>
                            ))}
                          </div>
                          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100">
                            <button onClick={e => { e.stopPropagation(); deleteMessage(msg.id); }} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); alert('Choose list to add'); }}> <Plus className="w-4 h-4 text-gray-500" /></button>
                          </div>
                        </div>
                        {expandedMsgId === msg.id && (
                          <>
                            {/* Mock AI Action Items */}
                            {mockActionItems[msg.id] && mockActionItems[msg.id].length > 0 && (
                              <div className="mb-0 border border-t-0 border-gray-200 bg-white px-4 pt-4 pb-2 flex flex-col gap-2 rounded-b-none rounded-t-none">
                                {mockActionItems[msg.id].map((step, idx) => (
                                  <div key={idx} className={`flex items-center gap-2 ${idx === (actionStepIdx[msg.id] || 0) ? '' : 'opacity-60'}`}>
                                    <span className="text-xs font-normal text-gray-700 flex-1"><span className="mr-1 text-gray-400">{idx + 1}.</span>{step}</span>
                                    {/* Always render buttons for layout stability, but hide for non-active steps */}
                                    <button
                                      className={`w-5 h-5 text-xs font-bold rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition flex items-center justify-center ${idx === (actionStepIdx[msg.id] || 0) ? '' : 'invisible'}`}
                                      disabled={idx !== (actionStepIdx[msg.id] || 0)}
                                      onClick={() => idx === (actionStepIdx[msg.id] || 0) && alert('Accepted: ' + step)}
                                      tabIndex={-1}
                                    >
                                      Y
                                    </button>
                                    <button
                                      className={`w-5 h-5 text-xs font-bold rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition flex items-center justify-center ${idx === (actionStepIdx[msg.id] || 0) ? '' : 'invisible'}`}
                                      disabled={idx !== (actionStepIdx[msg.id] || 0)}
                                      onClick={() => idx === (actionStepIdx[msg.id] || 0) && alert('Rejected: ' + step)}
                                      tabIndex={-1}
                                    >
                                      N
                                    </button>
                                    <button
                                      className={`ml-1 px-1.5 py-0.5 text-xs rounded border text-gray-700 border-gray-200 bg-gray-50 hover:bg-gray-100 transition ${idx === (actionStepIdx[msg.id] || 0) ? '' : 'invisible'}`}
                                      style={{ minWidth: 36, marginLeft: 'auto' }}
                                      disabled={idx !== (actionStepIdx[msg.id] || 0)}
                                      onClick={() => idx === (actionStepIdx[msg.id] || 0) && setActionStepIdx(idxObj => ({ ...idxObj, [msg.id]: ((idxObj[msg.id] || 0) + 1) % mockActionItems[msg.id].length }))}
                                      tabIndex={-1}
                                    >
                                      Tab
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div
                              className="border border-t-0 border-gray-200 rounded-b-xl bg-white px-4 py-4 flex flex-col gap-2"
                              tabIndex={-1}
                              onKeyDown={e => {
                                if (
                                  mockActionItems[msg.id] &&
                                  mockActionItems[msg.id].length > 0 &&
                                  e.key === 'Tab'
                                ) {
                                  e.preventDefault();
                                  setActionStepIdx(idxObj => ({ ...idxObj, [msg.id]: ((idxObj[msg.id] || 0) + 1) % mockActionItems[msg.id].length }));
                                }
                              }}
                            >
                              <textarea className="w-full h-24 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 text-black bg-white" placeholder="Give a command or respond..." />
                              <div className="flex justify-end">
                                <button className="mt-2 p-2 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center text-white">
                                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="12" fill="black" />
                                    <path d="M12 8V16M12 8L8 12M12 8L16 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
            </div>
          </div>
        </div>
        {/* Right Pane */}
        {selectedMsg && (
          <div className="fixed top-0 right-0 h-full w-1/3 border-l bg-white flex flex-col z-30">
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <div className="text-xs text-gray-400">{selectedMsg.source} – {selectedMsg.timestamp}</div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{selectedMsg.content}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.isArray(selectedMsg.tags) && selectedMsg.tags.map((tag, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-full ${tagColor(tag)}`}>{tag}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setSelectedMsg(null)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1">
              <textarea className="w-full h-32 p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-300 text-black bg-white" placeholder="Give a command or respond..." />
              <button className="mt-2 p-2 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="12" fill="black" />
                  <path d="M12 8V16M12 8L8 12M12 8L16 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Bottom Command Bar */}
      <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 w-full flex justify-center z-50">
        <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 shadow-md rounded-xl px-4 py-3 flex items-center gap-3">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Ask or command anything (e.g. 'Show me the message about Stripe payments')"
            className="flex-1 p-3 text-base border rounded-md focus:outline-none focus:ring text-black"
          />
          <button className="p-2 rounded hover:bg-gray-100">
            <Mic className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="12" fill="black" />
              <path d="M12 8V16M12 8L8 12M12 8L16 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
