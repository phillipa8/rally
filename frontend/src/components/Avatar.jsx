// Avatar.jsx — circular user avatar; falls back to initials when no image.
export default function Avatar({ user, size = 40 }) {
  const label = user?.displayName || user?.username || '?';
  const initials = label
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (user?.avatarUrl) {
    return (
      <img className="avatar" src={user.avatarUrl} alt={label} style={style} width={size} height={size} />
    );
  }
  return (
    <span className="avatar avatar--initials" style={style} aria-label={label} title={label}>
      {initials}
    </span>
  );
}
