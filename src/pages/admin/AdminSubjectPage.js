import React, { useState } from 'react';
import '../../styles/adminEntity.css';

/**
 * AdminSubjectPage manages subjects. Each subject belongs to a department,
 * has a name and credit count. This mock implementation allows
 * administrators to list, add and delete subjects.
 */
export default function AdminSubjectPage() {
  const [subjects, setSubjects] = useState([
    { id: 1, deptId: 1, name: '자료구조', credits: 3 },
    { id: 2, deptId: 1, name: '운영체제', credits: 3 },
    { id: 3, deptId: 2, name: '한국문학', credits: 2 },
  ]);
  const [mode, setMode] = useState('list');
  const [newSubj, setNewSubj] = useState({ deptId: '', name: '', credits: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    const nextId = subjects.length ? Math.max(...subjects.map((s) => s.id)) + 1 : 1;
    setSubjects([
      ...subjects,
      {
        id: nextId,
        deptId: parseInt(newSubj.deptId, 10),
        name: newSubj.name,
        credits: parseInt(newSubj.credits, 10),
      },
    ]);
    setNewSubj({ deptId: '', name: '', credits: '' });
    setMode('list');
  };

  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setSubjects(subjects.filter((s) => s.id !== id));
    }
  };

  return (
    <div className="admin-entity">
      <h2>강의 관리</h2>
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
                <th>학과ID</th>
                <th>이름</th>
                <th>학점</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.deptId}</td>
                  <td>{s.name}</td>
                  <td>{s.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'insert' && (
        <form onSubmit={handleAdd} className="entity-form">
          <div className="form-row">
            <label htmlFor="subjectDeptId">학과ID</label>
            <input
              id="subjectDeptId"
              type="number"
              value={newSubj.deptId}
              onChange={(e) => setNewSubj({ ...newSubj, deptId: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="subjectName">이름</label>
            <input
              id="subjectName"
              type="text"
              value={newSubj.name}
              onChange={(e) => setNewSubj({ ...newSubj, name: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="subjectCredits">학점</label>
            <input
              id="subjectCredits"
              type="number"
              value={newSubj.credits}
              onChange={(e) => setNewSubj({ ...newSubj, credits: e.target.value })}
              required
            />
          </div>
          <button type="submit">등록</button>
        </form>
      )}
      {mode === 'delete' && (
        <div className="entity-table-wrapper">
          <p>삭제할 강의를 선택하세요.</p>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>학과ID</th>
                <th>이름</th>
                <th>학점</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.deptId}</td>
                  <td>{s.name}</td>
                  <td>{s.credits}</td>
                  <td>
                    <button onClick={() => handleDelete(s.id)}>삭제</button>
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