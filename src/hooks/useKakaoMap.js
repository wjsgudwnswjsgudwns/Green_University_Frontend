import { useEffect, useState } from "react";

export default function useKakaoMap() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 단순히 window.kakao가 로드될 때까지 기다리기
    const checkKakao = () => {
      if (window.kakao && window.kakao.maps) {
        setIsLoaded(true);
        console.log("✅ 카카오맵 사용 가능!");
        return true;
      }
      return false;
    };

    // 즉시 확인
    if (checkKakao()) return;

    // 0.1초마다 확인
    const interval = setInterval(() => {
      if (checkKakao()) {
        clearInterval(interval);
      }
    }, 100);

    // 10초 후 포기
    const timeout = setTimeout(() => {
      clearInterval(interval);
      console.error("❌ 카카오맵 로드 타임아웃");
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return isLoaded;
}
