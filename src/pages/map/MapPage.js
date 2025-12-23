import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/mapPage.css";

export default function MapPage() {
  const navigate = useNavigate();
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("seoul");

  const campuses = [
    {
      id: "seoul",
      name: "서울 캠퍼스",
      address: "서울 마포구 신촌로 176",
      transport: {
        subway: {
          line: "2호선",
          station: "이대역 하차",
          exit: "6번",
          description: "신촌방향 10m 전방 중앙빌딩",
        },
        bus: {
          station: "이대역6번출구 정류장 하차",
          routes: [
            {
              type: "일반",
              numbers: "173, 5714, 6712",
            },
            {
              type: "마을",
              numbers: "서대문05(마을)",
            },
            {
              type: "시외",
              numbers: "G6000",
            },
          ],
        },
      },
    },
    {
      id: "gangnam",
      name: "신단수 캠퍼스",
      address: "서울 강남구 테헤란로 7길 7",
      transport: {
        subway: {
          line: "2호선",
          station: "강남역 하차",
          exit: "12번",
          description: "출구 옆 방향 직진 150m 국기원입구 교차로 좌회전",
        },
        bus: {
          station: "강남역12번출구 정류장 하차",
          routes: [
            {
              type: "일반",
              numbers: "040, 146, 360, 740, 3412",
            },
          ],
        },
      },
    },
  ];

  const currentCampus = campuses.find((c) => c.id === activeTab);

  // 카카오맵 로드 체크
  useEffect(() => {
    const checkKakao = () => {
      if (window.kakao && window.kakao.maps) {
        setIsMapLoaded(true);
        return true;
      }
      return false;
    };

    if (checkKakao()) return;

    const interval = setInterval(() => {
      if (checkKakao()) {
        clearInterval(interval);
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  // 지도 렌더링
  useEffect(() => {
    if (!isMapLoaded) return;

    const campus = campuses.find((c) => c.id === activeTab);
    if (!campus) return;

    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.addressSearch(campus.address, (result, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
        const container = document.getElementById("map-container");

        if (!container) return;

        const map = new window.kakao.maps.Map(container, {
          center: coords,
          level: 3,
        });

        const marker = new window.kakao.maps.Marker({
          position: coords,
          map: map,
        });

        const infowindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px;font-size:12px;">
                      <b>${campus.name}</b><br>${campus.address}
                    </div>`,
        });
        infowindow.open(map, marker);
      }
    });
  }, [isMapLoaded, activeTab]);

  if (!isMapLoaded) {
    return (
      <div className="map-loading-container">
        <div className="map-loading-content">
          <div className="map-loading-spinner"></div>
          <p className="map-loading-text">지도를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      {/* 헤더 */}
      <div className="map-header">
        <div className="map-header-container">
          <div className="map-header-content">
            <h1 className="map-header-title">찾아오시는길</h1>
          </div>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="map-tabs">
        <div className="map-tabs-container">
          <div className="map-tabs-list">
            {campuses.map((campus) => (
              <button
                key={campus.id}
                onClick={() => setActiveTab(campus.id)}
                className={`map-tab-button ${
                  activeTab === campus.id ? "active" : ""
                }`}
              >
                {campus.name}
                {activeTab === campus.id && (
                  <div className="map-tab-indicator"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 지도 컨테이너 */}
      <div className="map-content">
        <div className="map-wrapper">
          <div id="map-container" className="map-container"></div>
        </div>
      </div>

      {/* 교통 정보 */}
      {currentCampus && (
        <div className="map-transport-section">
          <div className="map-transport-container">
            {/* 지하철 이용 */}
            <div className="map-transport-column">
              <h3 className="map-transport-title">지하철 이용</h3>
              <div className="map-transport-item">
                <div className="map-transport-icon subway">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2C8 2 4 2.5 4 6V15.5C4 17.43 5.57 19 7.5 19L6 20.5V21H7L9 19H15L17 21H18V20.5L16.5 19C18.43 19 20 17.43 20 15.5V6C20 2.5 16 2 12 2M7.5 17C6.67 17 6 16.33 6 15.5S6.67 14 7.5 14 9 14.67 9 15.5 8.33 17 7.5 17M11 11H6V6H11V11M16.5 17C15.67 17 15 16.33 15 15.5S15.67 14 16.5 14 18 14.67 18 15.5 17.33 17 16.5 17M18 11H13V6H18V11Z" />
                  </svg>
                </div>
                <div className="map-transport-content">
                  <div className="map-transport-route">
                    <span className="map-transport-badge warning">
                      {currentCampus.transport.subway.line}
                    </span>
                    <span className="map-transport-label">
                      {currentCampus.transport.subway.station}
                    </span>
                  </div>
                  <div className="map-transport-detail">
                    <span className="map-transport-detail-badge">
                      {currentCampus.transport.subway.exit}
                    </span>
                    <span className="map-transport-detail-text">
                      {currentCampus.transport.subway.description}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 버스 이용 */}
            <div className="map-transport-column">
              <h3 className="map-transport-title">버스 이용</h3>
              <div className="map-transport-item">
                <div className="map-transport-icon bus">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18 11H6V6H18M16.5 17C15.67 17 15 16.33 15 15.5S15.67 14 16.5 14 18 14.67 18 15.5 17.33 17 16.5 17M7.5 17C6.67 17 6 16.33 6 15.5S6.67 14 7.5 14 9 14.67 9 15.5 8.33 17 7.5 17M4 16C4 16.88 4.39 17.67 5 18.22V20C5 20.55 5.45 21 6 21H7C7.55 21 8 20.55 8 20V19H16V20C16 20.55 16.45 21 17 21H18C18.55 21 19 20.55 19 20V18.22C19.61 17.67 20 16.88 20 16V6C20 2.5 16.42 2 12 2S4 2.5 4 6V16Z" />
                  </svg>
                </div>
                <div className="map-transport-content">
                  <div className="map-transport-route">
                    <span className="map-transport-badge warning">
                      {currentCampus.transport.bus.station}
                    </span>
                  </div>
                  {currentCampus.transport.bus.routes.map((bus, index) => (
                    <div key={index} className="map-transport-detail">
                      <span className="map-transport-detail-badge">
                        {bus.type}
                      </span>
                      <span className="map-transport-detail-text">
                        {bus.numbers}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
