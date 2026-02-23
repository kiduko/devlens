import type { CapturedRequest } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { parseRequestCookies } from '../../utils/cookies';

interface CookiesProps {
  request: CapturedRequest;
}

export function Cookies({ request }: CookiesProps) {
  const requestCookies = parseRequestCookies(request.requestHeaders['cookie'] || request.requestHeaders['Cookie'] || '');
  const responseCookies = request.cookies;

  if (requestCookies.length === 0 && responseCookies.length === 0) {
    return <EmptyState title="No cookies" />;
  }

  return (
    <div className="p-2 space-y-3">
      {requestCookies.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Request Cookies</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="font-medium pb-1">Name</th>
                <th className="font-medium pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {requestCookies.map((c, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-0.5 text-gray-600 font-medium">{c.name}</td>
                  <td className="py-0.5 text-gray-700 font-mono break-all">{c.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {responseCookies.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Response Cookies (Set-Cookie)</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="font-medium pb-1">Name</th>
                <th className="font-medium pb-1">Value</th>
                <th className="font-medium pb-1">Attributes</th>
              </tr>
            </thead>
            <tbody>
              {responseCookies.map((c, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-0.5 text-gray-600 font-medium">{c.name}</td>
                  <td className="py-0.5 text-gray-700 font-mono break-all">{c.value}</td>
                  <td className="py-0.5 text-gray-400 text-[10px]">
                    {[
                      c.domain && `Domain=${c.domain}`,
                      c.path && `Path=${c.path}`,
                      c.httpOnly && 'HttpOnly',
                      c.secure && 'Secure',
                      c.sameSite && `SameSite=${c.sameSite}`,
                    ].filter(Boolean).join('; ')}
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
