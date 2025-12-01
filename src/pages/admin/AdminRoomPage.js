import React, { useState } from 'react';
import '../../styles/adminEntity.css';

/**
 * AdminRoomPage manages lecture rooms. Each room has an ID, name and
 * capacity. The CRUD pattern is repeated here with local state.
 */
export default function AdminRoomPage() {
  const [rooms, setRooms] = useState([
    { id: 1, name: 'A101', capacity: 30 },
    { id: 2, name: 'B202', capacity: 40 },
    { id: 3, name: 'C303', capacity: 35 },
  ]);
  const [mode, setMode] = useState('list');
  const [newRoom, setNewRoom] = useState({ name: '', capacity: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    const nextId = rooms.length ? Math.max(...rooms.map((r) => r.id)) + 1 : 1;
    setRooms([
      ...rooms,
      { id: nextId, name: newRoom.name, capacity: parseInt(newRoom.capacity, 10) },
    ]);
    setNewRoom({ name: '', capacity: '' });
    setMode('list');
  };

  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setRooms(rooms.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="admin-entity">
      <h2>강의실 관리</h2>
      <div className="entity-actions">
        <button onClick={() => setMode('list')} className={mode === 'list' ? 'active' : ''}>조회</button>
        <button onClick={() => setMode('insert')} className={mode === 'insert' ? 'active' : ''}>등록</button>
        <button onClick={() => setMode('delete')} className={mode === 'delete' ? 'active' : ''}>삭제</button>
      </div>
      {mode === 'list' && (
        <div className="entity-table-wrapper">
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>수용인원</th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'insert' && (
        <form onSubmit={handleAdd} className="entity-form">
          <div className="form-row">
            <label htmlFor="roomName">이름</label>
            <input
              id="roomName"
              type="text"
              value={newRoom.name}
              onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="roomCapacity">수용인원</label>
            <input
              id="roomCapacity"
              type="number"
              value={newRoom.capacity}
              onChange={(e) => setNewRoom({ ...newRoom, capacity: e.target.value })}
              required
            />
          </div>
          <button type="submit">등록</button>
        </form>
      )}
      {mode === 'delete' && (
        <div className="entity-table-wrapper">
          <p>삭제할 강의실을 선택하세요.</p>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>수용인원</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.capacity}</td>
                  <td>
                    <button onClick={() => handleDelete(r.id)}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}