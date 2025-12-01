import React, { useState } from 'react';
import '../../styles/adminEntity.css';

/**
 * AdminDepartmentPage manages departments. Follows the same CRUD pattern
 * as AdminCollegePage. It uses local state to mock data.
 */
export default function AdminDepartmentPage() {
  const [departments, setDepartments] = useState([
    { id: 1, collegeId: 1, name: '컴퓨터공학과' },
    { id: 2, collegeId: 1, name: '전자공학과' },
    { id: 3, collegeId: 2, name: '국어국문학과' },
  ]);
  const [mode, setMode] = useState('list');
  const [newDept, setNewDept] = useState({ collegeId: '', name: '' });

  const handleAdd = (e) => {
    e.preventDefault();
    const nextId = departments.length ? Math.max(...departments.map((d) => d.id)) + 1 : 1;
    setDepartments([
      ...departments,
      { id: nextId, collegeId: parseInt(newDept.collegeId, 10), name: newDept.name },
    ]);
    setNewDept({ collegeId: '', name: '' });
    setMode('list');
  };

  const handleDelete = (id) => {
    if (window.confirm('정말 삭제하시겠습니까?')) {
      setDepartments(departments.filter((d) => d.id !== id));
    }
  };

  return (
    <div className="admin-entity">
      <h2>학과 관리</h2>
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
                <th>이름</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.collegeId}</td>
                  <td>{d.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'insert' && (
        <form onSubmit={handleAdd} className="entity-form">
          <div className="form-row">
            <label htmlFor="deptCollegeId">단과대학ID</label>
            <input
              id="deptCollegeId"
              type="number"
              value={newDept.collegeId}
              onChange={(e) => setNewDept({ ...newDept, collegeId: e.target.value })}
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="deptName">이름</label>
            <input
              id="deptName"
              type="text"
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              required
            />
          </div>
          <button type="submit">등록</button>
        </form>
      )}
      {mode === 'delete' && (
        <div className="entity-table-wrapper">
          <p>삭제할 학과를 선택하세요.</p>
          <table className="entity-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>단과대학ID</th>
                <th>이름</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.id}</td>
                  <td>{d.collegeId}</td>
                  <td>{d.name}</td>
                  <td>
                    <button onClick={() => handleDelete(d.id)}>삭제</button>
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