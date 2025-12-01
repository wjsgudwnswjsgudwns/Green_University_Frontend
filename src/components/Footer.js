import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/footer.css';

/**
 * Footer component placed at the bottom of every page.  
 * Contains copyright information and a link to the project repository.
 */
export default function Footer() {
  return (
    <footer className="footer">
      <p>
        COPYRIGHT© 2023&nbsp;
        <Link to="https://github.com/seoyounglee0105/university_management_project" target="_blank" rel="noopener noreferrer">
          GREEN UNIVERSITY
        </Link>
        . ALL RIGHTS RESERVED.
      </p>
    </footer>
  );
}