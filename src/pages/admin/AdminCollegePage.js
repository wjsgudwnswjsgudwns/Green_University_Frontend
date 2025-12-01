import React, { useState } from 'react';
import '../../styles/adminEntity.css';

/**
 * AdminCollegePage manages the list of colleges. Administrators can
 * view existing colleges, add a new college or delete an existing one.
 * This mirrors the JSP page functionality but keeps state locally.
 */
export default function AdminCollegePage() {
  const [colleges, setColleges] = useState([
    { id: 1, name: '공과대학' },
    { id: 2, name: '인문대학' },
    { id: 3, name: '자연과학대학' },
  ]);
  const [mode, setMode] = useState('list'); // 'list', 'insert', 'delete'
  const [newName, setNewName] = useState('');

  // Handle adding a new college
  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      return;
    }
    const nextId = colleges.length ? Math.max(...colleges.map((c) => c.id)) + 1 : 1;
    setColleges([...colleges, { id: nextId, name: newName.trim() }]);
    setNewName('');
    setMode('list');
  };

  // Handle deleting a college by id
  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setColleges(colleges.filter((c) => c.id !== id));
    }
  };

  return (
    <div className="admin-entity">
      <h2>단과대학 관리</h2>
      <div className="entity-actions">
        <button onClick={() => setMode('list')} className={mode === 'list' ? 'active' : ''}>조회</button>
        <button onClick={() => setMode('insert')} className={mode === 'insert' ? 'active' : ''}>등록</button>
        <button onClick={() => setMode('delete')} className={mode === 'delete' ? 'active' : ''}>삭제</button>
      </div>
      {/* List mode */}
      {mode === 'list' && (
        <div className="entity-table-wrapper">
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Insert mode */}
      {mode === 'insert' && (
        <form onSubmit={handleAdd} className="entity-form">
          <div className="form-row">
            <label htmlFor="collegeName">이름</label>
            <input
              id="collegeName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="단과대학 이름을 입력하세요"
              required
            />
          </div>
          <button type="submit">등록</button>
        </form>
      )}
      {/* Delete mode */}
      {mode === 'delete' && (
        <div className="entity-table-wrapper">
          <p>삭제할 단과대학을 선택하세요.</p>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {colleges.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>
                    <button onClick={() => handleDelete(c.id)}>삭제</button>
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