import React from 'react'
import SkillCard from '../components/skill/SkillCard'

const Skills: React.FC = () => {
  const skills = [
    {
      id: '1',
      name: 'commit',
      description: 'Create well-formatted commits with conventional commit messages',
      status: 'Active' as const,
      iconColor: '#E42313'
    },
    {
      id: '2',
      name: 'review-pr',
      description: 'Review pull requests and provide feedback',
      status: 'Active' as const,
      iconColor: '#2196F3'
    },
    {
      id: '3',
      name: 'test-runner',
      description: 'Run tests and report results',
      status: 'Inactive' as const,
      iconColor: '#4CAF50'
    },
    {
      id: '4',
      name: 'code-formatter',
      description: 'Format code according to project standards',
      status: 'Active' as const,
      iconColor: '#FF9800'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        <h1
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '24px',
            fontWeight: '700',
            color: '#0D0D0D',
            margin: 0
          }}
        >
          Skills
        </h1>

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#E42313',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontFamily: 'Space Grotesk',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          + Add Skill
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {skills.map((skill) => (
          <SkillCard
            key={skill.id}
            name={skill.name}
            description={skill.description}
            status={skill.status}
            iconColor={skill.iconColor}
          />
        ))}
      </div>
    </div>
  )
}

export default Skills
