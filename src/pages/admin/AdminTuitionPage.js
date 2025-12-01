import React, { useState } from 'react';
import '../../styles/adminEntity.css';

/**
 * AdminTuitionPage manages tuition fees per college. Data is mocked and
 * administrators can view, add and remove fee entries.
 */
export default function AdminTuitionPage() {
  const [tuition, setTuition] = useState([
    { id: 1, collegeId: 1, amount: 3000000 },
    { id: 2, collegeId: 2, amount: 2500000 },
  ]);
  const [mode, setMode] = useState('list');
  const [newFee, setNewFee] = useState({ collegeId: '', amount: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    const nextId = tuition.length ? Math.max(...tuition.map((t) => t.id)) + 1 : 1;
    setTuition([
      ...tuition,
      { id: nextId, collegeId: parseInt(newFee.collegeId, 10), amount: parseInt(newFee.amount, 10) },
    ]);
    setNewFee({ collegeId: '', amount: '' });
    setMode('list');
  };

  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setTuition(tuition.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="admin-entity">
      <h2>등록금 관리</h2>
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
                <th>단과대학ID</th>
                <th>등록금(원)</th>
              </tr>
            </thead>
            <tbody>
              {tuition.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.collegeId}</td>
                  <td>{t.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'insert' && (
        <form onSubmit={handleAdd} className="entity-form">
          <div className="form-row">
            <label htmlFor="tuitionCollegeId">단과대학ID</label>
            <input
              id="tuitionCollegeId"
              type="number"
              value={newFee.collegeId}
              onChange={(e) => setNewFee({ ...newFee, collegeId: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="tuitionAmount">등록금</label>
            <input
              id="tuitionAmount"
              type="number"
              value={newFee.amount}
              onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })}
              required
            />
          </div>
          <button type="submit">등록</button>
        </form>
      )}
      {mode === 'delete' && (
        <div className="entity-table-wrapper">
          <p>삭제할 등록금을 선택하세요.</p>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>단과대학ID</th>
                <th>등록금(원)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tuition.map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.collegeId}</td>
                  <td>{t.amount.toLocaleString()}</td>
                  <td>
                    <button onClick={() => handleDelete(t.id)}>삭제</button>
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