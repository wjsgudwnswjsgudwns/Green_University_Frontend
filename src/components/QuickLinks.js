import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  Award,
  CreditCard,
  Calendar,
  FileText,
  MessageSquare,
  Users,
  Star,
  UserPlus,
  Clock,
  AlertTriangle,
  Video,
  Settings,
  Bell,
  LayoutDashboard,
  Briefcase,
} from "lucide-react";
import "../styles/quickLinks.css";

export default function QuickLinks() {
  const { user } = useAuth();

  const quickLinksData = {
    student: [
      { name: "수강신청", link: "/sugang/application", icon: BookOpen },
      { name: "성적조회", link: "/grade/total", icon: Award },
      { name: "등록금납부", link: "/student/tuition/list", icon: CreditCard },
      { name: "시간표", link: "/sugang/schedule", icon: Calendar },
      {
        name: "학습 지원",
        link: `/student/learningai/${user?.id}`,
        icon: FileText,
      },
      { name: "상담", link: "/student/counseling", icon: MessageSquare },
    ],
    professor: [
      { name: "수강생관리", link: "/professor/subject", icon: Users },
      { name: "강의평가", link: "/evaluation/read", icon: Star },
      {
        name: "학생상담",
        link: "/aiprofessor/counseling",
        icon: MessageSquare,
      },
      {
        name: "상담일정",
        link: "/aiprofessor/counseling/schedule",
        icon: Clock,
      },
      {
        name: "위험학생",
        link: "/aiprofessor/counseling/risk",
        icon: AlertTriangle,
      },
      {
        name: "화상회의",
        link: "/aiprofessor/counseling/meetings",
        icon: Video,
      },
    ],
    staff: [
      { name: "학생관리", link: "/staff/student-list", icon: Users },
      { name: "교수관리", link: "/staff/professor-list", icon: Briefcase },
      { name: "공지작성", link: "/board/notice/write", icon: Bell },
      { name: "학사일정", link: "/schedule/manage", icon: Calendar },
      { name: "수강신청기간", link: "/staff/course-period", icon: Clock },
      { name: "시스템관리", link: "/staff/admin", icon: Settings },
    ],
  };

  const links = quickLinksData[user?.userRole] || [];

  if (!user || links.length === 0) {
    return null;
  }

  return (
    <div className="quick-links-card">
      <div className="quick-links-header">
        <h3>빠른 메뉴</h3>
      </div>
      <div className="quick-links-grid">
        {links.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <Link key={index} to={item.link} className="quick-link-item">
              <div className="quick-link-icon">
                <IconComponent size={28} strokeWidth={1.5} />
              </div>
              <span className="quick-link-text">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
