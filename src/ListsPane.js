import React, { useState, useEffect, useRef } from "react";
import { fetchLists, addList } from "./api/lists";
import { Plus } from "lucide-react";

export default function ListsPane() {
  const [lists, setLists] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newList, setNewList] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchLists().then(lists => {
      setLists(lists);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (adding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [adding]);

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newList.trim()) return;
    try {
      const added = await addList(newList.trim());
      setLists((prev) => [added, ...prev]);
      setNewList("");
      setAdding(false);
    } catch (error) {
      alert(error.message || JSON.stringify(error));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between p-0 pb-2">
        <div className="font-semibold text-sm text-gray-500 uppercase">Lists</div>
        <button
          className="p-1 rounded hover:bg-gray-100"
          onClick={() => {
            setAdding(true);
            setNewList("");
          }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {adding && (
        <form onSubmit={handleAddList} className="mb-2">
          <input
            ref={inputRef}
            value={newList}
            onChange={e => setNewList(e.target.value)}
            placeholder="New list name"
            className="border p-1 rounded w-full text-sm placeholder-gray-400"
            onBlur={() => { setAdding(false); setNewList(""); }}
            style={{ marginBottom: 4 }}
          />
        </form>
      )}
      {loading ? (
        <div className="text-xs text-gray-400">Loading...</div>
      ) : (
        <ul className="space-y-2">
          {lists.map(list => (
            <li key={list.id} className="p-2 rounded hover:bg-gray-100 cursor-pointer text-sm">
              {list.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 