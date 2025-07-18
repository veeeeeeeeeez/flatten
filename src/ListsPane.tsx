import React, { useState, useEffect, useRef } from "react";
import { fetchLists, addList } from "./api/lists";
import { Plus } from "lucide-react";
import { List } from "./types";
import "./styles/ListsPane.css";

export default function ListsPane(): JSX.Element {
  const [lists, setLists] = useState<List[]>([]);
  const [adding, setAdding] = useState<boolean>(false);
  const [newList, setNewList] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleAddList = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!newList.trim()) return;
    try {
      const added = await addList(newList.trim());
      setLists((prev) => [added, ...prev]);
      setNewList("");
      setAdding(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : JSON.stringify(error));
    }
  };

  return (
    <div className="lists-container">
      <div className="lists-header">
        <div className="lists-title">Lists</div>
        <button
          className="add-button"
          onClick={() => {
            setAdding(true);
            setNewList("");
          }}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {adding && (
        <form onSubmit={handleAddList} className="add-form">
          <input
            ref={inputRef}
            value={newList}
            onChange={e => setNewList(e.target.value)}
            placeholder="New list name"
            className="add-input"
            onBlur={() => { setAdding(false); setNewList(""); }}
          />
        </form>
      )}
      {loading ? (
        <div className="loading-text">Loading...</div>
      ) : (
        <ul className="lists-ul">
          {lists.map(list => (
            <li key={list.id} className="list-item">
              {list.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 